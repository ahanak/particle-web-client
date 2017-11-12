registerApp('particle-pwm-controller');

/** The controller for the particle-pwm-controller app */
app.controller('PwmCtrl', ['$scope', '$http', '$interval', 'sparkapi', function($scope, $http, $interval, sparkapi) {
    $scope.device = null;
    $scope.scenes = [];
    $scope.chasers = [];
    $scope.turnedOn = "unknown";
    $scope.brightness = 255;
    $scope.hasWhite = false;
    $scope.white = 0;
    $scope.hasBrightnessChanged = false;
    $scope.hasWhiteChanged = false;


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

    /** Turn the device on and show white light. */
    $scope.showWhite = function() {
        if(!$scope.turnedOn) {$scope.turnOn();}
        $scope.brightness = 255;
        $scope.hasBrightnessChanged = true;
        $scope.setColors([0,0]);
        $scope.white = 255;
        $scope.hasWhiteChanged = true;
    };

    /** Set the specified colors. */
    $scope.setColors = function(colors_array) {
        sparkapi.callFunction($scope.device.id, 'setColors', colors_array.join(";")).then(
            function(result) {
                if(colors_array.length == 2) {
                    var c1 = '#' + inverseGammaCorrect(colors_array[0]);
                    var c2 = '#' + inverseGammaCorrect(colors_array[1]);
                    $scope.sentColor1 = c1;
                    $scope.color1 = c1;
                    $scope.sentColor2 = c2;
                    $scope.color2 = c2;
                }
            },
            function(error) {}
        );
    };

    /** Transmit a chaser to the stripe. */
    $scope.setChaser = function(steps_array) {
        sparkapi.callFunction($scope.device.id, 'setChaser', steps_array.join(';')).then(
            function(result) {},
            function(error) {}
        );
    };

    /** Load the default chaser that is programmed into the controller. */
    $scope.defChaser = function() {
        sparkapi.callFunction($scope.device.id, 'defChaser', null).then(
            function(result) {},
            function(error) {}
        );
    };


    /** Must be called at beginning to define the device to use. */
    $scope.setDevice = function (device) {
        $scope.device = device;
        if (device != null) {
            //sparkapi.registerDeviceEvents($scope.device.id, onEvent);
            $scope.hasWhite = (device.functions.indexOf("setWhite") >= 0);
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
        if($scope.brightness != 255) {$scope.hasBrightnessChanged = true;}
        if($scope.brightness >= 0 && $scope.device != null  && $scope.hasBrightnessChanged) {
            brightnessStop = $interval(function () {
                //console.log("Publishing " + $scope.brightness.toString());
                sparkapi.callFunction($scope.device.id, 'setMaster', $scope.brightness.toString());
            }, 300, 1);
        }
    });

    /**
     * The slider movement means that $scope.white changes very often.
     * We do not want to create an http request each time, so we filter that.
     *
     * If the white slider has been moved, wait 300ms for further movements.
     * If no further change happens, send the data to the device.
     *
     * This is done with a timer. On every slider value change, stop a maybe running timer and start a new timer,
     * that will transmit the value after 300ms.
     */
    var whiteStop = null;
    $scope.$watch('white', function(){
        if($scope.hasWhite) {
            if (whiteStop != null) {
                $interval.cancel(whiteStop);
                whiteStop = null;
            }
            if ($scope.white >= 0 && $scope.device != null && $scope.hasWhiteChanged) {
                whiteStop = $interval(function () {
                    //console.log("Publishing " + $scope.brightness.toString());
                    sparkapi.callFunction($scope.device.id, 'setWhite', $scope.white.toString());
                }, 300, 1);
            }
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


    $scope.sentColor1 = "#0000ff";
    $scope.color1 = "#0000ff";
    $scope.sentColor2 = "#00ffff";
    $scope.color2 = "#00ffff";
    $scope.inlinesettings = {
        control: 'wheel',
        inline: true
    };
    var colorStop = null;
    $scope.$watch('color1', watchColor);
    $scope.$watch('color2', watchColor);
    function watchColor() {
        if(colorStop != null) {
            $interval.cancel(colorStop);
            colorStop = null;
        }

        colorStop = $interval(function () {
            if($scope.color1 != $scope.sentColor1 || $scope.color2 != $scope.sentColor2) {
                console.log("Color1:" + $scope.color1 + " Color2:" + $scope.color2);
                $scope.setColors([gammaCorrect($scope.color1), gammaCorrect($scope.color2)]);
                $scope.sentColor1 = $scope.color1;
                $scope.sentColor2 = $scope.color2;
            }
        }, 300, 1);
    }


    function gammaCorrect(color) {
        var rgb = hexToRgb(color);
        rgb.r = gammaForComponent(rgb.r);
        rgb.g = gammaForComponent(rgb.g);
        rgb.b = gammaForComponent(rgb.b);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function inverseGammaCorrect(color) {
        var rgb = hexToRgb(color);
        rgb.r = inverseGammaForComponent(rgb.r);
        rgb.g = inverseGammaForComponent(rgb.g);
        rgb.b = inverseGammaForComponent(rgb.b);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(r, g, b) {
        return componentToHex(r) + componentToHex(g) + componentToHex(b);
    }

    var gammaTable = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25, 25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36, 37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89, 90, 92, 93, 95, 96, 98, 99,101,102,104,105,107,109,110,112,114, 115,117,119,120,122,124,126,127,129,131,133,135,137,138,140,142, 144,146,148,150,152,154,156,158,160,162,164,167,169,171,173,175, 177,180,182,184,186,189,191,193,196,198,200,203,205,208,210,213, 215,218,220,223,225,228,231,233,236,239,241,244,247,249,252,255 ];
    function gammaForComponent(component) {
        return gammaTable[component];
    }
    function inverseGammaForComponent(component) {
        for(var i = 0; i < gammaTable.length; i++) {
            if(gammaTable[i] >= component) {
                return i;
            }
        }
        return 255;
    }

}]);