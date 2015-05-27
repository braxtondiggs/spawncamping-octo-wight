'use strict';
angular.module('Alma.controllers')
	.controller('PlayerSettingsDetailCtrl', ['$scope', '$rootScope', '$cordovaCamera', '$cordovaDialogs', '$cordovaToast', '$ionicLoading', '$timeout', 'PubNub', 'lodash', function($scope, $rootScope, $cordovaCamera, $cordovaDialogs, $cordovaToast, $ionicLoading, $timeout, PubNub, lodash) {
		/*global Parse*/
		/*global WifiWizard*/
		$scope.psd = {
			hasErrors: false
		};
		$scope.submitForm = function(isValid, name, address, isWifi, SSID, wifiPassword) {
			if (isValid) {
				$scope.psd.hasErrors = false;
				isWifi = (isWifi.toLowerCase() === 'true')?true:false;
				$scope.psd.geoCode(address, function(geocode) {
					$scope.playerSettings.server.set('isSetup', true);
					$scope.playerSettings.server.set('userId', Parse.User.current());
					$scope.playerSettings.server.set('latlng', new Parse.GeoPoint({latitude: geocode.latitude, longitude: geocode.longitude}));
					$scope.playerSettings.server.set('isWifi', isWifi);
					$scope.playerSettings.server.set('SSID', SSID);
					$scope.playerSettings.server.save();
					$scope.modal.hide();
					$ionicLoading.show({
						template: 'Save was succesful...',
						duration: 2000
					});
					if (!lodash.isEmpty($scope.playerSettings.new)) {
						$scope.players.push($scope.playerSettings.server);
					}
					var id = (!lodash.isEmpty($scope.playerSettings.new))?$scope.playerSettings.new.objID:$scope.playerSettings.server.id;
					if (isWifi) {
						PubNub.ngPublish({
							channel: id + 'WiFi',
							message: {'type': 'setWifi', 'ssid': SSID, 'isWifi': isWifi, 'password': wifiPassword}
						});
					}else {
						PubNub.ngPublish({
							channel: id,
							message: {'type': 'player_update', 'id': id, 'isWifi': isWifi}
						});
					}
					$scope.playerSettings.server = null;
				});
			}else {
				$scope.psd.hasErrors = true;
			}
		};
		$rootScope.$on(PubNub.ngMsgEv($scope.$storage.connectedPlayer), function(event, payload) {
			if (payload.message.type === 'setWifiConfirm') {
				if (payload.message.status) {
					/*PubNub.ngPublish({
						channel: id,
						message: {'type': 'player_update', 'id': id, 'isWifi': isWifi}
					});*/
				}else {
					$cordovaDialogs.alert('Your WiFi password was incorrect', 'Alma - Error');
				}
			}
		});

		$scope.psd.geoCode = function(address, callback) {
			/*global GeocoderJS*/
			var googleGeocoder = new GeocoderJS.createGeocoder({'provider': 'google'});
			googleGeocoder.geocode(address, function(result) {
				callback(result[0]);
			});
		};
		$scope.inputChange = function(name, input) {
			$scope.playerSettings.server.set(name, input);
		};
		$scope.clearImage = function() {
			$scope.playerSettings.server.unset('image');
			$scope.playerSettings.server.save();
		};
		$scope.getImage = function() {
			/* global Camera*/
			var pickerOptions = {
				destinationType: Camera.DestinationType.DATA_URL,
				sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
				quality: 50,
				EncodingType: Camera.EncodingType.PNG,
				MediaType: Camera.MediaType.PICTURE,
				targetWidth: 150,
				targetHeight: 150
			};
			$cordovaCamera.getPicture(pickerOptions).then(function(imageData) {
				var file = new Parse.File((!lodash.isEmpty($scope.playerSettings.new))?$scope.playerSettings.new.objID:$scope.playerSettings.server.id + '.png', {
					base64: imageData
				});
				$scope.playerSettings.server.set('image', file);
			}, function() {
				$ionicLoading.hide();
				$ionicLoading.show({
					template: 'Error, could not load photo...',
					duration: 2000
				});
			});
		};
		$scope.Ethernet = function() {
			$scope.network = false;
		};
		$scope.wifiNotification = function() {
			$cordovaDialogs.alert('It is very important that you are on the same WiFi network that you want to setup your Alma player.', 'Alma').then(function() {
				$scope.network = true;
				//if (WifiWizard) {
					function WifiSetup() {
						function enableSuccess() {
							$timeout(function() {
								WifiSetup();
							}, 4000);
							$cordovaToast.show('Wifi enabled successfully', 'short', 'bottom');
						}
						function enableFail() {
							$scope.network = false;
							$cordovaDialogs.alert('Could not enable WiFi, please enable your WiFi in your phone\'s system settings', 'Alma - Error');
						} 
						WifiWizard.isWifiEnabled(function(status) {
							if (status) {
								WifiWizard.getCurrentSSID(function(ssid) {
									$scope.ssid = ssid.replace(/['"]+/g, '');
									$scope.$apply();
								});
							}else {
								$cordovaDialogs.confirm('Your Wifi is not turned on, do want us to try and enable it for you?', 'Alma', ['Yes','Cancel']).then(function(res) {
									if (res === 1) {
										WifiWizard.setWifiEnabled(true, enableSuccess, enableFail);
									}else {
										$scope.network = false;
										$cordovaDialogs.alert('Could not enable WiFi, please enable your WiFi in your phone\'s system settings', 'Alma - Error');
									}
								});
							}
						});
					}
					WifiSetup();
				//}
			});
		};
	}]);