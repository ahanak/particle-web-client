registerApp('tinker');

/** The devices controller handles the devices page with possibilities to get variables, call functions and show device events. */
app.controller('TinkerCtrl', ['$scope', '$http', function($scope, $http) {
    $scope.tinkerDevice = null;
    var allPins = null;
    $http.get('apps/tinker/pins.json').then(function(res) {
        allPins = res.data;
        $scope.updatePins();
    });

    /** Read the digital value of the given port and store the result in $scope.pins */
    $scope.digitalRead = function(port) {
        sparkapi.callFunction(device.id, 'digitalread').then(
            function(result) {
                $scope.pins[port].value = result.data.return_value;
            },
            function(error) {}
        );
    };

    /** Read the digital value of the given port and store the result in $scope.pins */
    $scope.analogRead = function(port) {
        if($scope.pins[port].type != 'analog') {return;}

        sparkapi.callFunction($scope.device.id, 'analogread', port).then(
            function(result) {
                $scope.pins[port].value = result.data.return_value;
            },
            function(error) {}
        );
    };

    /** Read the digital value of the given port and store the result in $scope.pins */
    $scope.digitalWrite = function(port,value) {
        var digitalValue = (value ? 'HIGH' : 'LOW');
        sparkapi.callFunction($scope.device.id, 'digitalwrite', port + ',' + digitalValue).then(
            function(result) {
                if(result.data.return_value != 1) {
                    console.log("Error in digitalWrite: " + result.data.return_value);
                };
            },
            function(error) {}
        );
    };

    /** Read the digital value of the given port and store the result in $scope.pins */
    $scope.analogWrite = function(port,value) {
        sparkapi.callFunction(device.id, 'analogwrite', port + ',' + value).then(
            function(result) {
                if(result.data.return_value != 1) {
                    console.log("Error in analogWrite: " + result.data.return_value);
                };
            },
            function(error) {}
        );
    };

    $scope.setDevice = function (device) {
        $scope.tinkerDevice = device;
        $scope.updatePins();
    };

    $scope.updatePins = function() {
        if(allPins != null && $scope.tinkerDevice != null) {

            $scope.pins = allPins[$scope.tinkerDevice.platform_id];
        }
    };

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