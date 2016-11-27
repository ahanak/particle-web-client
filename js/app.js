angular.forEach(enabledApps, function(app) {
    // load the javascript based on a fixed directory structure
    var url = 'apps/' + app + '/main.js';
    $.ajax({
        url: url,
        dataType: "script",
        async: false
    });
    console.log("Loaded " + url + '?');
    //$.getScript()
    //    .done(function(script, textStatus) { console.log('Loaded ' + app + ' app'); scriptLoaded = true;})
    //    .fail(function( jqxhr, settings, exception ) {console.warn('Failed to load ' + app + ' app'); scriptLoaded = false;});
});


/** This is our main module for the particle web client application */
app = angular.module("ParticleWebClient", ['ngRoute', 'ngStorage']);

/** configure our routes */
app.config(function($routeProvider, $httpProvider, appselectorProvider) {
    $routeProvider
        .when('/devices', { templateUrl: 'tpl/devices.tpl.html', resolve:{
            authorize: function(loginService) { return loginService.authorize(); }
        }})
        .when('/events', { templateUrl: 'tpl/events.tpl.html', resolve:{
            authorize: function(loginService) { return loginService.authorize(); }
        }})
        .when('/login', { templateUrl: 'tpl/login.tpl.html' })
        .otherwise({ redirectTo: '/login' });

    // load the main.js script for each enabled plugin and create a route with the plugin name which renders the main.tpl.html
    angular.forEach(enabledPlugins, function(plugin) {
        // load the javascript based on a fixed directory structure
        $.getScript('plugins/' + plugin + '/main.js')
            .done(function(script, textStatus) { console.log('Loaded ' + plugin + ' plugin')})
            .fail(function( jqxhr, settings, exception ) {console.warn('Failed to load ' + plugin + ' plugin')});
        $routeProvider.when('/' + plugin, {templateUrl: 'plugins/' + plugin + '/main.tpl.html', resolve: {
            authorize: function(loginService) { return loginService.authorize(); }
        }})
    });


    angular.forEach(enabledApps, function(app) {
        $.getJSON('apps/' + app + '/config.json', function(data) {
            appselectorProvider.addApp(data, 'apps/' + app + '/main.tpl.html');
        });
    });

    // detect authorization errors
    $httpProvider.interceptors.push('sparkapiInterceptor');

    // trigger spinner
    $httpProvider.interceptors.push('spinnerInterceptor');

});

app.provider('appselector', function() {
    var currentApps = [];
    this.addApp = function (app, template) {
        app.template = template;
        currentApps.push(app);
    };

    this.$get = function() {

        return {
            selectTemplate: function (device) {
                var template = 'tpl/general_device.tpl.html';
                angular.forEach(currentApps, function (app) {
                    var appMatches = true;
                    angular.forEach(app.required.functions, function (requiredFunction) {
                        if (device.functions.indexOf(requiredFunction) < 0) {
                            appMatches = false;
                        }
                    });
                    angular.forEach(app.required.variables, function (requiredVariable) {
                        if (device.variables.indexOf(requiredVariable) < 0) {
                            appMatches = false;
                        }
                    });
                    //TODO: name and firmware
                    if (appMatches == true) {
                        template = app.template;
                    }
                });
                return template;
            }

        }
    }
});

/* ************************************************ Sparkapi ******************************************************** */

/** Define the spark api as own implemented service. Functions return promises like $http does. */
app.factory('sparkapi', function($http) {
    baseUrl = 'https://api.particle.io/v1';

    return {
        /** Contains the complete spark token structure as object. */
        token: null,

        /** Handles the token object containing the access_token returned by login.
         * You need to call this function after a successful login. */
        setToken: function(token) {
            this.token = token;

            // tell $http to use the obtained access_token in am authorization header in all requests
            $http.defaults.headers.common.Authorization = 'Bearer ' + token.access_token;
        },

        /** Login with credentials ({username: 'a', pasword: 'b'}) to obtain an access_token inside a token object. */
        login: function(credentials) {
            form_data = {
                username: credentials.username,
                password: credentials.password,
                grant_type: 'password',
                client_id: 'Particle',
                client_secret: 'Particle'
            };
            return $http({
                method: 'POST',
                transformRequest: function(obj) {
                    var str = [];
                    for(var p in obj)
                        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
                    return str.join("&");
                },
                url: 'https://api.particle.io/oauth/token',
                data: form_data,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'}
            });
        },

        /** Get detailed information about a device given the device id. */
        device: function (deviceId) {
            return $http.get(baseUrl + '/devices/' + deviceId);
        },

        /** Get a list of own devices with few information only. */
        listDevices: function() {
            return $http.get(baseUrl + '/devices');
        },

        /** Call a function for the device with the given device id with the argument(s) given as string. */
        callFunction: function(deviceId, functionName, args) {
            return $http.post(baseUrl + '/devices/' + deviceId + '/' + functionName, {args: args});
        },

        /** Read a variable from the device with the given device id. */
        readVariable: function(deviceId, variableName) {
            return $http.get(baseUrl + '/devices/' + deviceId + '/' + variableName);
        },

        /** Register a handler which will be called for each incoming event from the the device with
         * the given device id.
         * DeviceId can be "mine" to obtain events for all owned devices */
        registerDeviceEvents: function(deviceId, handler) {
            spark.login({accessToken: this.token.access_token});
            spark.getEventStream(false, deviceId,  function(data) {
                if(data.name != 'Error' || data.published_at) {
                    handler.call(this, data);
                } else {
                    console.log('Empty error event filtered.');
                }
            });
        },

        /** Register a handler which will be called for each incoming event from any owned device. */
        registerMineEvents: function(handler) {
            this.registerDeviceEvents('mine', handler);
        },

        publishEvent: function(event) {
            return $http.post(baseUrl + '/devices/events', event);
        }
    }
});

/** Handle errors in api calls. */
app.factory('sparkapiInterceptor', function($rootScope, $q) {
    return {
        responseError: function (reject) {
            $rootScope.$broadcast('http_error', reject);
            if (reject.status === 401) {
                console.log("401 intercepted");
                $rootScope.$broadcast('unauthorized');
            }
            return $q.reject(reject.data);
        }
    };
});

/**
 * Show spinner while $http is working.
 * See http://stackoverflow.com/questions/17838708/implementing-loading-spinner-using-httpinterceptor-and-angularjs-1-1-5
 */
app.factory('spinnerInterceptor', function ($q, $rootScope) {
    var numLoadings = 0;
    return {
        request: function (config) {
            numLoadings++;

            // Show loader
            $rootScope.$broadcast("loader_show");
            return config || $q.when(config)
        },
        response: function (response) {
            if ((--numLoadings) === 0) {
                // Hide loader
                $rootScope.$broadcast("loader_hide");
            }
            return response || $q.when(response);
        },
        responseError: function (response) {
            if (!(--numLoadings)) {
                // Hide loader
                $rootScope.$broadcast("loader_hide");
            }
            return $q.reject(response);
        }
    };
});

/* ************************************************ LoginService **************************************************** */

/** Stores whether the user is logged in or not to keep the GUI up to date. */
app.factory('loginService', function($location, $q, $localStorage) {
    return {
        /** Is the user logged in? */
        loggedIn: false,

        /** Contains the route that the user requested before he was asked to login. */
        nextRoute: '/devices',

        /** Look for an existing access-token in the $localstorage (HTML5 storage in browser) */
        init: function() {
            if($localStorage.token) {
                this.loggedIn = true;
                return $localStorage.token;
            } else {
                this.loggedIn = false;
                return false;
            }
        },

        /** Set login status to logged in and store the token if desired (store is true). */
        login: function(token, store) {
            this.loggedIn = true;
            if(store) {
                $localStorage.token = token;
            }
        },

        /** Set the state to logged out */
        logout: function() {
            this.loggedIn = false;
            if($localStorage.token) {
                $localStorage.token = false;
            }
        },

        /** This function should be used in "authorize" for route changes. */
        authorize: function() {
            if(this.loggedIn) {
                return true;
            } else {
                // reject the route
                // nextRoute must be set in the error handler
                return $q.reject('Not Authenticated');
            }
        }

    };
});

/* ************************************************ NavibarCtr ****************************************************** */

/** This controller is responsible for the navigation. It is used to highlight the active page and some more. */
app.controller('NavibarCtrl', ['$rootScope', '$scope', '$location', 'loginService', function($rootScope, $scope, $location, loginService) {
    $scope.loginService = loginService;
    /** Redirect to /login if the route change failed bevause of an login error. */
    $rootScope.$on("$routeChangeError", function(event, nextRoute, currentRoute) {
        // redirect to login
        $location.path('/login');

        console.log(nextRoute.params);
        // save the desired route to redirect to it after login
        loginService.nextRoute = nextRoute.originalPath;
    });

    /** Return true if the given path is the currently displayed one. */
    $scope.isActive = function(path) {
        return ($location.path().substr(0, path.length) === path) ? 'active' : false;
    };

    $scope.plugins = enabledPlugins;

    /** Log the current user out and redirect to login form. */
    $scope.logout = function() {
        if(loginService.loggedIn) {
            loginService.logout();
            $location.path('/login');
        }
    };

    $rootScope.$on('unauthorized', function() {
        $scope.logout();
    });
}]);

/* ************************************************ ErrorCtr ******************************************************** */

/** This controller displays errors on the main layout */
app.controller('ErrorCtrl', ['$rootScope', '$scope', '$location', 'loginService', function($rootScope, $scope) {
    $scope.message = "";

    $scope.clear = function() {
        $scope.message = "";
    };

    $rootScope.$on('http_error', function(event, httperror) {
        var sparkerror = httperror.data;
        var message = httperror.config.url + ' ' + httperror.statusText + ' (' + httperror.status + ')';
        if(sparkerror && sparkerror.error_description) {
             message += " - " + sparkerror.error_description;
        }
        $scope.message = message;
    });
}]);

/* ************************************************ LoginCtr ******************************************************** */

/** The login controller handles the sign-in form */
app.controller('LoginCtrl', ['$scope', '$location', '$localStorage', 'sparkapi', 'loginService', function($scope, $location, $localStorage, sparkapi, loginService) {

    /** Make an api call to the particle cloud to obtain an access token */
    $scope.login = function(credentials) {
        sparkapi.login(credentials).then(
            function(response) {
                token = response.data;
                console.log('Obtained access-token: ', token.access_token);
                loginService.login(token, $scope.rememberMe);
                $scope.handleSuccessfulLogin(token);
            },
            function(err) { }
        );
    };

    /** maybe, the user has already logged in before and a access_token is stored? */
    $scope.tryAutoLogon = function() {
        var token = loginService.init();
        if (token && token.access_token) {
            $scope.handleSuccessfulLogin(token);
        }
    };

    /** use the obtained token for the particle api and redirect to the desired path */
    $scope.handleSuccessfulLogin = function (token) {
        sparkapi.setToken(token);
        $location.path(loginService.nextRoute);
    };

    $scope.tryAutoLogon();
}]);

/* ************************************************ DevicesCtr ****************************************************** */

/** The devices controller handles the devices page with possibilities to get variables, call functions and show device events. */
app.controller('DevicesCtrl', ['$scope', 'loginService', 'sparkapi', 'appselector', function($scope, loginService, sparkapi, appselector) {

    /** Query the device list from the api, then query details for each device and store that information in the scope. */
    $scope.list = function() {
        $scope.devices = [];
        sparkapi.listDevices().then(
            function(result){
                //console.log('API call completed on promise resolve: ', devices);
                //$scope.devices = result.data;
                angular.forEach(result.data, function(deviceEntry) {
                    var deviceIndex = null;
                    sparkapi.device(deviceEntry.id).then(
                        function(result) {
                            deviceIndex = $scope.devices.push(result.data) - 1;
                            console.log(result.data);
                        },
                        function(error) {}
                    );

                    $scope.events[deviceEntry.id] = [];
                    sparkapi.registerDeviceEvents(deviceEntry.id, function(data) {
                        $scope.$apply(function() {
                            //console.log(data);
                            $scope.events[deviceEntry.id].push(data);
                            while($scope.events[deviceEntry.id].length > 10) {
                                $scope.events[deviceEntry.id].shift();
                            }

                            if(data.name == 'spark/status') {
                                //reload
                                sparkapi.device(deviceEntry.id).then(
                                    function(result) {
                                        if (deviceIndex != null) {
                                            $scope.devices[deviceIndex] = result.data;
                                            console.log(result.data);
                                        }
                                    },
                                    function(error) {}
                                );
                            }
                        });
                    })
                });
            },
            function(err) {
                console.log('API call completed on promise fail: ', err);
                //$scope.errors[err.message] = true;
                $scope.error = err.message;
            }
        );
    };

    /** Call a function using the api and store the result in $scope.functionResults. */
    $scope.callFunction = function(deviceId, functionName, params) {
        console.log("Calling " + functionName + '(' + params + ')');
        sparkapi.callFunction(deviceId, functionName, params).then(
            function(result) {
                $scope.functionResults[deviceId + functionName] = result.data.return_value;
            },
            function(error) {}
        );
    };

    /** Query a variable via api and store the result in $scope.variableValues. */
    $scope.readVariable = function(deviceId, variableName) {
        console.log("Reading " + variableName);
        sparkapi.readVariable(deviceId, variableName).then(
            function(result) {
                $scope.variableValues[deviceId + variableName] = result.data.result;
            },
            function(error) {}
        )
    };

    /** Select the app template, which handles that device, see appselector service. */
    $scope.selectTemplate = function(device) {
        var template = appselector.selectTemplate(device);
        console.log('Selected template for ' + device.name + ': ' + template);
        return template;
    };

    /** Reset the $scope. */
    $scope.clear = function() {
        $scope.functionResults = {};
        $scope.functionArgs = {};
        $scope.variableValues = {};
        $scope.events = {};
    };

    $scope.clear();
    $scope.list();

}]);

/* ************************************************ EventsCtr ******************************************************* */

/** The events controller handles events for all owned devices or those sent via rest api call and filters them. */
app.controller('EventsCtr', ['$scope', 'loginService', 'sparkapi', function($scope, loginService, sparkapi) {

    /** Tell the api what to do if a event is triggered: Store it in $scope.events. */
    $scope.registerHandler = function() {
        sparkapi.registerMineEvents(function(data) {
            $scope.$apply(function() {
                data.deviceName = $scope.getName(data.coreid);
                $scope.events.unshift(data);
                while ($scope.events.length > 1000) {
                    $scope.events.pop();
                }
            });
        });
    };

    /** Load devices from API. This is important to display the human readable names for devices instead of their ids. */
    $scope.loadDevices = function () {
        sparkapi.listDevices().then(
            function(response){
                angular.forEach(response.data, function(deviceEntry) {
                    $scope.devices[deviceEntry.id] = deviceEntry.name;
                });
            },
            function(error){ }
        );
    };

    /** Translate device ids into names if "loadDevices" was successful before. */
    $scope.getName = function(deviceId) {
        if($scope.devices.hasOwnProperty(deviceId)) {
            return $scope.devices[deviceId];
        } else {
            return deviceId;
        }
    };
    
    $scope.publishEvent = function (event) {
        sparkapi.publishEvent(event);
    };

    /** Reset the $scope. */
    $scope.clear = function() {
        $scope.events = [];

        // If a event is created i.e. by a pc calling the rest web api, it will origin from the device with id '001'.
        // As the (virtual) device '001' won't appear in the device list, we need to add a name for it.
        $scope.devices = { '001': 'Web API'};

        // each filters can be cleared seperately in a function
        $scope.clearDeviceFilters();
        $scope.clearNameFilter();
        $scope.clearDataFilter();

        // init publish form
        $scope.clearPublishForm();

        $scope.loadDevices();
    };

    /** reset the device filters */
    $scope.clearDeviceFilters = function() {
        $scope.deviceFilters = {};
    };

    /** reset the name filter */
    $scope.clearNameFilter = function() {
        $scope.nameFilter = {method: 'contains'};
    };

    /** reset the data filter  */
    $scope.clearDataFilter = function() {
        $scope.dataFilter = {method: 'contains'};
    };

    $scope.clearPublishForm = function() {
        $scope.eventform = { name: "", data: "", private: true};
    };

    /** Return true if any field in the object ist true. This is used to see if at least one checkbox is checked. */
    $scope.anyFieldTrue = function(object) {
        var oneFieldIsTrue = false;
        angular.forEach(object, function(value, key) {
            if(value == true) {
                oneFieldIsTrue = true;
            }
        });
        return oneFieldIsTrue;
    };

    $scope.clear();
    $scope.registerHandler();
}]);

/** This flter searches for strings in a list of objects. The field of the compared object can be selected and
 * the method of comparison can be "equals", "contains" or "regex".
 */
app.filter('advSearch', function($filter) {
    var filterFilter = $filter('filter');

    return function(input, expression, field) {
        // return unchangedinput if no search text is present
        if(!(expression && expression.text && expression.text.length > 0)) { return input; }

        var filter_expression;
        if(field) {
            filter_expression = {};
            filter_expression[field] = expression.text;
        } else {
            filter_expression = expression.text;
        }

        var comperator;
        if(expression.method == 'regex') {
            comperator = function(actual, expected) {
                return (actual.search(new RegExp(expected, "i")) >= 0);
            };
        } else if(expression.method == 'equals') {
            comperator = true;
        } else {
            // contains
            comperator = false;
        }

        return filterFilter(input, filter_expression, comperator);
    };
});

/** This shows only entries that are queal to one value in a list of values. **/
app.filter('enumFilter', function($filter) {
    var filterFilter = $filter('filter');

    return function(input, enums, field) {
        // return unchangedinput if no search text is present
        if(!enums) { return input; }

        // do not filter anything if no checkboxes are selected
        var showEntries = [];
        angular.forEach(enums, function(show, entryName) {
            if(show) { showEntries.push(entryName); }
        });
        if(showEntries.length == 0) { return input; }

        var filter_expression;
        if(field) {
            filter_expression = {};
            filter_expression[field] = enums;
        } else {
            filter_expression = enums;
        }

        var comperator = function(actual, expected) {
            //return actual.search(expected) > 0;
            console.log(expected);
            return expected[actual] == true;
        };


        return filterFilter(input, filter_expression, comperator);
    };
});

/******************************************** Directives (HTML-Tags) for all pages ************************************/

/** Display a device panel using <device-panel device="myDevice">...</device-panel> */
app.directive('devicePanel', [function() {
    return {
        templateUrl : 'tpl/device-panel.tpl.html',
        // this is new to AngularJS 1.3
        /*bindToController: true,*/
        scope: {
            device: '='
        },
        restrict: 'E',
        transclude: true
    }
}]);

/** Display a spinner/loader using something like <img loader... /> */
app.directive("loader", function ($rootScope) {
    return function ($scope, element, attrs) {
        $scope.$on("loader_show", function () {
            return element.show();
        });
        return $scope.$on("loader_hide", function () {
            return element.hide();
        });
    };
});
























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