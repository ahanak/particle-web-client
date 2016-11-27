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
    });

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
    }, 10000);
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

    $scope.setDevice = function (device) {
        $scope.device = device;
        if (device != null) {
            sparkapi.readVariable(device.id, "numPresets").then(
                function (result) {
                    $scope.numPresets = result.data.result;
                },
                function (error) {
                }
            )
        }
    };

    $scope.$watch('numPresets', updateProgramButtons);
    $scope.$watch('programNames', updateProgramButtons);
    function updateProgramButtons() {
        var buttons = [];
        for(var i = 0; i < $scope.numPresets; i++) {
            var name = $scope.programNames[i] || "Programm " + i;
            buttons.push(name);
        }
        $scope.programButtons = buttons;
    }

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


    /** Reset the $scope. */
    $scope.clear = function() {
        $scope.functionResults = {};
        $scope.functionArgs = {};
        $scope.variableValues = {};
        $scope.events = {};
    };

    //$scope.clear();
    //$scope.list();

}]);