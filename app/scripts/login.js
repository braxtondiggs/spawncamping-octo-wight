'use strict';
angular.module('Quilava.controllers')
.controller('LoginCtrl', ['$scope', '$rootScope', '$ionicPopup', '$localStorage', '$cordovaOauth', function($scope, $rootScope, $ionicPopup, $localStorage, $cordovaOauth) {
  /*global Parse*/
  $scope.login = {
    hasErrors: false,
    error: null,
    success: null,
    showPositive: false
  }; 
  $scope.doLogin = function(isValid, email, password) {
    if (isValid) {
      var user = new Parse.User();
      user.set('username', email);
      user.set('password', password);
      user = new Parse.User({
        username: email,
        password: password
      });
      user.logIn({
        success: function(userData) {
          $rootScope.currentUser = userData;
          $scope.login.hasErrors = false;
          $scope.closeLogin(true);
          $scope.$apply();
        },
        error: function() {
          $scope.login = {
            hasErrors: true,
            error: 'Invalid login credentials. Please try again.'
          };
          $scope.$apply();
        }
      });
    }else {
      console.log('errors');
      $scope.login.hasErrors = true;
    }
  };
  $scope.doSignup = function(isValid, name, email, password) {
    if (isValid) {
      var user = new Parse.User();
      user.set('name', name);
      user.set('email', email);
      user.set('username', email);
      user.set('password', password);
      user.signUp(null, {
        success: function(userData) {
          $rootScope.currentUser = userData;
          $scope.login.hasErrors = false;
          $scope.closeLogin(true);
          $scope.$apply();
        },
        error: function() {
          $scope.login = {
            hasErrors: true,
            error: 'That email has already been taken'
          };
          $scope.$apply();
        }
      });
    }else {
      $scope.login.hasErrors = false;
    }
  };
  $scope.forgotMyPassword = function(email) {
    if (!email.$invalid) {
      $ionicPopup.confirm({
        title: 'MVPlayer',
        template: 'Did you forget your password?',
        buttons: [
        { text: 'Cancel' },
        { text: 'Yes',
          type: 'button-positive',
          onTap: function() {
            Parse.User.requestPasswordReset(email, {
              success: function() {
                $scope.login = {
                  hasErrors: false,
                  showPositive: true,
                  error: null,
                  success: 'Please check your email, a new password has been sent there.'
                };
                $scope.$apply();
              },
              error: function() {
                $scope.login = {
                  hasErrors: true,
                  error: null,
                  success: 'THat email address is not is our system.'
                };
                $scope.$apply();
              }
            });
          }
        }]
      });
    }else {
      $scope.login = {
        hasErrors: true,
        error: 'Please enter a valid email.'
      };
    }
  };
  $scope.facebookLogin = function() {
    $cordovaOauth.facebook('575282862608789', ['email']).then(function(result) {
      console.log('Response Object -> ' + JSON.stringify(result));
    }, function(error) {
      console.log(error);
    });
  };
  $scope.twitterLogin = function() {
    $cordovaOauth.twitter('ooP4LLRRJ51r454e3j7bVHc04', '6YBjrkeOSiEbCiqGe9H9POpxcMGdfyXfYlJvB1CUrjm8lv1Ayo').then(function(result) {
      console.log('Response Object -> ' + JSON.stringify(result));
    }, function(error) {
      console.log(error);
    });
  };
}]);