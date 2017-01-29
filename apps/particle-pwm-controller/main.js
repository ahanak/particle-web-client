registerApp('particle-pwm-controller');

/** The controller for the particle-pwm-controller app */
app.controller('PwmCtrl', ['$scope', '$http', '$interval', 'sparkapi', function($scope, $http, $interval, sparkapi) {
    $scope.device = null;
    $scope.scenes = [];
    $scope.chasers = [];
    $scope.turnedOn = "unknown";
    $scope.brightness = 255;

    $http.get('apps/particle-pwm-controller/scenes.json').then(function(res) {
        $scope.scenes = res.data;
    });

    $http.get('apps/particle-pwm-controller/chasers.json').then(function(res) {
        $scope.chasers = res.data;
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
    $scope.setColors = function(colors_array) {
        sparkapi.callFunction($scope.device.id, 'setColors', colors_array.join(";")).then(
            function(result) {},
            function(error) {}
        );
    };

    /** Load the next preset */
    $scope.setChaser = function(steps_array) {
        sparkapi.callFunction($scope.device.id, 'setChaser', steps_array.join(';')).then(
            function(result) {},
            function(error) {}
        );
    };

    $scope.defChaser = function() {
        sparkapi.callFunction($scope.device.id, 'setChaser', null).then(
            function(result) {},
            function(error) {}
        );
    };


    /** Must be called at beginning to define the device to use. */
    $scope.setDevice = function (device) {
        $scope.device = device;
        if (device != null) {
            //sparkapi.registerDeviceEvents($scope.device.id, onEvent);
        }
    };

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
        if(event.name == "PWM_STATUS") {
            console.log("Event: " + event.data);
            try {
                var data = JSON.parse(event.data);
                $scope.turnedOn = data.turnedOn;
                $scope.brightness = data.brightness;
            } catch(error) {
                console.log(error);
            }
        }
    }

}]);