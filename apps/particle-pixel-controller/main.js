registerApp('particle-pixel-controller');

/** The controller for the particle-pixel-controller app */
app.controller('PixelCtrl', ['$scope', '$http', '$interval', 'sparkapi', function($scope, $http, $interval, sparkapi) {
    $scope.device = null;
    $scope.programNames = null;
    $scope.programButtons = [];
    $scope.preset = -1;
    $scope.numPresets = 0;
    $scope.turnedOn = "unknown";
    $scope.fps = null;
    $scope.brightness = -1;

    $http.get('apps/particle-pixel-controller/programs.json').then(function(res) {
        $scope.programNames = res.data;
        updateProgramButtons();
    });

    /** the timer is used to poll the fps variable periodically */
    var stopTimer = $interval(function getFps() {
        if($scope.device != null) {
            sparkapi.readVariable($scope.device.id, 'fps').then(
                function (result) {
                    $scope.fps = result.data.result;
                },
                function (error) {
                }
            );
        }
    }, 60000);
    $scope.$on('$destroy', function() {
        if(angular.isDefined(stopTimer)) {
            // Make sure that the interval is destroyed too
            $interval.cancel(stopTimer);
        }
    });

    /** Turn the device on */
    $scope.turnOn = function() {
        sparkapi.callFunction($scope.device.id, 'turnOn').then(
            function(result) {
                $scope.turnedOn = (result.data.return_value == 1);
            },
            function(error) {}
        );
    };

    /** Turn the device off */
    $scope.turnOff = function() {
        sparkapi.callFunction($scope.device.id, 'turnOff').then(
            function(result) {
                $scope.turnedOn = (result.data.return_value == 1);
            },
            function(error) {}
        );
    };

    /** Load a specified preset */
    $scope.loadPreset = function(presetNumber) {
        sparkapi.callFunction($scope.device.id, 'loadPreset', presetNumber.toString()).then(
            function(result) {
                $scope.preset = result.data.return_value;
            },
            function(error) {}
        );
    };

    /** Load the next preset */
    $scope.nextPreset = function() {
        sparkapi.callFunction($scope.device.id, 'nextPreset').then(
            function(result) {
                $scope.preset = result.data.return_value;
            },
            function(error) {}
        );
    };

    /** Must be called at beginning to define the device to use. */
    $scope.setDevice = function (device) {
        $scope.device = device;
        if (device != null) {
            sparkapi.registerDeviceEvents($scope.device.id, onEvent);
            sparkapi.readVariable(device.id, "numPresets").then(
                function (result) {
                    $scope.numPresets = result.data.result;
                    updateProgramButtons();

                    // ugly: wait for the event connection to be established.
                    // Unfortunately, we do not have a callback for that.
                    // We are making a lot of connections at startup, so it might take a while.
                    // This is why we do it 3s after the numPresets request is finished.
                    $interval(function(){sparkapi.callFunction(device.id, "reqStatus")}, 3000, 1);
                },
                function (error) {
                }
            );


        }
    };

    /** The program buttons are generated from programs.json (stored in programNames) and numPresets. */
    //$scope.$watch('numPresets', updateProgramButtons);
    //$scope.$watch('programNames', updateProgramButtons);
    function updateProgramButtons() {
        var buttons = [];
        for(var i = 0; i < $scope.numPresets; i++) {
            var name = $scope.programNames[i] || "Programm " + i;
            buttons.push(name);
        }
        $scope.programButtons = buttons;
    }

    /**
     * The slider movement means that $scope.brightness changes very often.
     * We do not want to create an http request each time, so we filter that.
     *
     * If the brightness slider has been moved, wait 300ms for further movements.
     * If no further change happens, send the data to the device.
     *
     * This is done with a timer. On every slider value change, stop a maybe running timer and start a new timer,
     * that will transmit the value after 300ms.
     */
    var brightnessStop = null;
    $scope.$watch('brightness', function(){
        if(brightnessStop != null) {
            $interval.cancel(brightnessStop);
            brightnessStop = null;
        }
        if($scope.brightness >= 0) {
            brightnessStop = $interval(function () {
                //console.log("Publishing " + $scope.brightness.toString());
                sparkapi.callFunction($scope.device.id, 'setMaster', $scope.brightness.toString());
            }, 300, 1);
        }
    });

    /**
     * Wait for events indicating status changes, so that we can update the GUI.
     * This is important if this app runs on multiple devices or if the stripe state changes for another reason.
     */
    function onEvent(event) {
        if(event.name == "PIXEL_STATUS") {
            console.log("Event: " + event.data);
            try {
                var data = JSON.parse(event.data);
                $scope.turnedOn = data.turnedOn;
                $scope.brightness = data.brightness;
                $scope.preset = data.program;
            } catch(error) {
                console.log(error);
            }
        }
    }

}]);