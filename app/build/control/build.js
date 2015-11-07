﻿'use strict';

// Wildcard Filter for Army List builder
armyBuilder.filter('wildcardArmy', function () {
    return function (items, search) {
        var filtered = [];

        if (typeof search !== 'undefined') {
            var searchRegEx = search.replace(/[^A-za-zÄÖÜäöü?]/g, '.*?');
            var thisRegex = new RegExp('.*?' + searchRegEx + '.*?', 'i');
        }

        angular.forEach(items, function (item) {
            if (typeof search !== 'undefined') {
                if (thisRegex.test(item.name)) {
                    filtered.push(item);
                }
            } else {
                filtered.push(item);
            }
        });

        return filtered;
    };
});

// Controller to build the examplelist and the top Navigation
armyBuilder.controller('buildCtrl',
    function ($scope, $http, $routeParams, $location) {
    
    	$http.get('./data/' + $routeParams.army + '.json').
		success(
            function(data, status, headers, config) {
                // only add data with entries
                $scope.data = [];
                $.each(data.groups, function(key, item) {
                    if (item.entries.length !== 0) {
                        $scope.data.push(item);
                    }
                });

                $scope.tiers = data.tiers;
                $scope.tier = {};
                $scope.tierLevel = 0;
                $scope.selectedModels = [];
                $scope.gameCaster = 1;
                $scope.gamePoints = 20;
                $scope.gameTier = 0;
                $scope.modlaLevel = 0;
                $scope.points = 0;
                $scope.dropModel = {};
                $scope.casterPoints = 0;
                $scope.costAlterations = [];
                $scope.freeModels = [];
                $scope.faction = $('#' + $routeParams.army).data('faction');
                $scope.system = $('#' + $routeParams.army).data('system');

                //restore from URL
                $scope.restoreSearch();

                var favicon = new Favico();
                var image = $('#' + $routeParams.army + ' img')[0];
                favicon.image(image);

                document.title = $scope.faction + ' - Troop Creator';

                // Menu set selected
                $( '#top-menu li' ).removeClass( 'active' );
                $( '#' + $routeParams.army ).closest('li').addClass('active');

                $('.btn').focus(function() {
                    this.blur();
                });
		    }
        ).
		error(
            function(data, status, headers, config) {
                alert('error reading ' + $routeParams.army + '.json');
		    }
        );

        // accordion function for list
        $scope.accordion = function(id, open) {
            var $this = $('.accordion-'+id);
            if ( open ) {
                $this.slideDown();
            } else {
                $this.slideToggle();
            }
            $this.parent().siblings().find('.accordion-container').slideUp();
        };

        // Check if model an warcaster/warlock
        $scope.checkIsCaster = function(model) {
            return /warcaster|warlock/i.test(model.type);
        };

		// Check if this model available
		$scope.checkModelAvailable = function(model) {
            var cost = $scope.getModelCost(model, true);
            if ( $scope.gameTier && $scope.checkModelTier(model) ) {
                return true;
            }

			// gameCaster not set or no usable int
			if ( typeof $scope.gameCaster === 'undefined' || $scope.gameCaster.length === 0 || isNaN($scope.gameCaster)) {
                return true;
            }

            // gamePoints not set or no usable int
			if ( typeof $scope.gamePoints === 'undefined' || $scope.gamePoints.length === 0 || isNaN($scope.gamePoints)) {
                return true;
            }

			// Warlock have max value in selectedModels
            if ( /warlock/i.test(model.type) && $scope.countType('warlock') >= $scope.gameCaster ) {
				return true;
            }

            // Warcaster have max value in selectedModels
            if ( /warcaster/i.test(model.type) && $scope.countType('warcaster') >= $scope.gameCaster ) {
				return true;
            }

			// No Caster in selectedModels we can not select an Warbeast or Warjack
            if ( /warbeast|warjack/i.test(model.type) && $scope.countType('warlock|warcaster') === 0 ) {
				return true;
            }

            // The Points to use are higher as the available points but check if warbeast an we have available caster points
            if ( /warbeast|warjack/i.test(model.type) && parseInt($scope.casterPoints) > 0) {
		    	if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt($scope.casterPoints) ) < cost) {
		            return true;
				}
            } else if ( !$scope.checkIsCaster(model) ) {
                if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) ) < cost) {
                    return true;
                }
            }

            // Check if field allowance at cap
            if ( !model.fa || model.fa !== 'U' ) {
            	var mc = 0;
            	var fa = false;

            	$.each($scope.selectedModels, function(k, selectedModel) {
                    // if Character and we always have in list
                    if ( model.fa === 'C' && selectedModel.name === model.name ) {
                        fa = true;
                        return false;
                    }

                    // Count field allowance model
                    if ( selectedModel.name === model.name ) {
                        mc ++;
                    }

                    // if field allowance model full
                    if ( model.fa <= mc ) {
                        fa = true;
                        return false;
                    }
				});

                // Check if this an free tier model an ignores the FA
                if ( cost === 0 && model.cost !== 0 ) {
                    fa = false;
                }

				// field allowance full
				if ( fa ) {
					return true;
				}
            }

            // The model only can attached to but not  set the base model
            if ( model.hasOwnProperty('restricted_to') ) {
            	for (var i = 0, len = $scope.selectedModels.length; i < len; i++) {
                    if (typeof model.restricted_to === 'string') {
                        if ($scope.selectedModels[i].id === model.restricted_to || model.restricted_to === '*') {
                            return false;
                        }
                    } else {
                        var found = false;
                        angular.forEach(model.restricted_to, function(val) {
                            if ($scope.selectedModels[i].id === val ) {
                                found = true;
                                return false;
                            }
                        });
                        if (found === true ) {
                            return false;
                        }
                    }
				}
				return true;
            }

            // All its fine we can activate the model
            return false;
        };

        // we have an Tier an check if the model allowed
        $scope.checkModelTier = function(model) {
            var tier = $scope.tiers[$scope.gameTier];
            return tier.levels[0].onlyModels.ids.indexOf(model.id) === -1;
        };

        // count all types in list
        $scope.countType = function(type) {
            var count = 0;
            var matcher = new RegExp(type, "i");
            if ( $scope.selectedModels ) {
                $.each($scope.selectedModels, function (key, selectedModel) {
                    if (matcher.test(selectedModel.type)) {
                        count++;
                    }
                });
            }
            return count;
        };

        // Drop callback for dragable
        $scope.dropCallback = function(event, ui) {
            var dragScope = angular.element(ui.draggable).scope();
            $scope.addModel(dragScope.model);
        };

        // start drag callback
        $scope.startCallback = function(event, ui) {
            var prevWidth = ui.helper.prevObject.width();
            ui.helper.css({'width': prevWidth});
        };

        // Add an model from the left to the right
        $scope.addModel = function(model) {
            if ( !$scope.checkModelAvailable(model) ) {
                var copy = angular.copy(model);

                // If type warbeast or warjack we must add it after the last warbeast/warjack oder after the last warlock/warcaster
                // If baseUnit set we must add this model to an unit
                var findIndex = false;
                if (/warbeast|warjack/i.test(model.type)) {
                    for (var i = $scope.selectedModels.length - 1; i >= 0; i--) {
                        if (/warbeast|warlock|warjack|warcaster/i.test($scope.selectedModels[i].type)) {
                            findIndex = i;
                            break;
                        }
                    }
                } else if (model.hasOwnProperty('restricted_to')) {
                    for (var i = $scope.selectedModels.length - 1; i >= 0; i--) {
                        if ($scope.selectedModels[i].id === model.restricted_to) {
                            findIndex = i;
                            break;
                        }
                    }
                }

                // check if the model we add an free model but only if tier
                if ( $scope.tier ) {
                    var cost = $scope.getModelCost(model, true);
                    if ( cost === 0 ) {
                        copy.cost = 0;
                        copy.freeModel = 1;
                    }
                }

                // If we find a postion where we add the model add or add to the end
                if (findIndex !== false) {
                    copy.bonded = 1;
                    $scope.selectedModels.splice(findIndex + 1, 0, copy);
                } else {
                    $scope.selectedModels.push(copy);
                }
                $scope.calculateAvailablePoints();
            }
        };

        // Remove an Model from the right
        $scope.removeModel = function(index) {
            if ( $scope.selectedModels[index + 1] !== undefined && !$scope.selectedModels[index].hasOwnProperty('bonded') && $scope.selectedModels[index + 1].hasOwnProperty('bonded') ) {
                if ( !confirm(unescape("Wenn Sie dieses Model l%F6schen werden auch alle angeschlossenen Modelle gel%F6scht%21 wollen Sie wirklich l%F6schen%3F")) ) {
                    return false;
                }

                // Let us se how much models are bonded to the model we like to del
                var modelsToDel = 0;
                for ( var i = index +1, len = $scope.selectedModels.length; i < len; i ++ ) {
                    if ( $scope.selectedModels[i].hasOwnProperty('bonded') ) {
                        modelsToDel ++;
                    } else {
                        // we have count all models an can leave the for
                        break;
                    }
                }

                $scope.selectedModels.splice(index, modelsToDel + 1);
            } else {
                $scope.selectedModels.splice(index, 1);
            }

        	$scope.calculateAvailablePoints();
        };

        // Unit use Base Size
        $scope.unitUseMax = function(type, index, set) {
        	$scope.selectedModels[index].useMax = set;
            $scope.calculateAvailablePoints();
        };

        // Is there enough points to use max size
        $scope.canUseMax = function(model) {
       		return ( !model.useMax && ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt(model.cost) ) < parseInt(model.costMax) );
        };

        // Calculate the available Points
        $scope.calculateAvailablePoints = function() {
			var sumPoints = 0;
			var casterPoints = 0;

			$.each( $scope.selectedModels, function( key, model ) {
                // Change the cost to the tier bonus cost
                var cost = $scope.getModelCost(model);

				if ( /warlock|warcaster/i.test(model.type) ) {
                    casterPoints = casterPoints + parseInt(cost);
				} else if ( /warjack|warbeast/i.test(model.type) ) {
                    // if he bonTo none we must calculate the points to the sumPoints and not to casterPoints
                    if ( model.hasOwnProperty('bondTo') && model.restricted_to === 'none' ) {
                        sumPoints = sumPoints + cost;
                    } else {
                        casterPoints = casterPoints - cost;
                    }
				} else {
                    // Must we use the base cost of model or the max
                    if ( model.useMax ) {
                        sumPoints = sumPoints + parseInt(model.costMax);
                    } else {
                        sumPoints = sumPoints + cost;
                    }
				}
			});

			if ( casterPoints < 0 ) {
				$scope.points = sumPoints - ( casterPoints * +1 );
			} else {
				$scope.points = sumPoints;
			}

            // Set the available Caster points for later Checks
            $scope.casterPoints = casterPoints;

            // Store the models in URL
            $scope.updateSearch();

            // Calculate the tier level
            $scope.calculateTierLevel();
		};

        // Calculate the tier level
        $scope.calculateTierLevel = function() {
            if ( $scope.tier ) {
                $scope.resetTierBonus();
                $.each($scope.tier.levels, function(idx, level) {

                    var mustCount = 0;
                    if ( !level.mustHave[0] ) {
                        $scope.tierLevel = level.level;
                        $scope.setTierBonus(level);
                    } else {

                        $.each(level.mustHave, function(idx, must) {
                            var have = 0;
                            $.each($scope.selectedModels, function(idx, selectedModel) {
                                // if we have the model in list by Id
                                if ( $.inArray(selectedModel.id, must.ids ) !== -1 ) {
                                    have ++;
                                }
                                if ( have >= must.min ) {
                                    mustCount ++;
                                    return false;
                                }
                            });
                        });

                        if ( level.mustHave.length === mustCount ) {
                            $scope.tierLevel = level.level;
                            $scope.setTierBonus(level);
                        } else {
                            return false;
                        }
                    }
                });
            }
        };

        // Set the Tier bonus points or models
        $scope.setTierBonus = function(level) {
            // Add alteration of points to an model
            if ( level.costAlterations.length > 0 ) {
                $.each(level.costAlterations, function(key, val) {
                    $scope.costAlterations[val.id] = val.bonus;
                });
            }
            if ( level.freeModels.length > 0 ) {
                $.each(level.freeModels, function(key, val) {
                    $scope.freeModels.push(val);
                });
            }
        };

        // reset the Tier Bonus
        $scope.resetTierBonus = function() {
            $scope.costAlterations = [];
            $scope.freeModels = [];
        };

        // get alternate cost
        $scope.getModelCost = function(model, checkFree) {
            if ( typeof(checkFree) === 'undefined' ) checkFree = false;

            // only run this checks if we have an tier
            if ( $scope.tier ) {
                // Check for bonus points for Models
                var bonus = $scope.costAlterations[model.id];
                if (bonus) {
                    return parseInt(model.cost - bonus);
                }

                // Check for free models
                if ($scope.freeModels.length > 0 && checkFree) {

                    var hasFree = false,
                        isFree = false;
                    $.each($scope.freeModels, function (key, freeModel) {
                        $.each($scope.selectedModels, function (idx, selectedModel) {
                            // if we have the model in list by Id and the cost is for 0
                            hasFree = ( $.inArray(selectedModel.id, freeModel.id) !== -1 && selectedModel.cost === 0 );

                            if (hasFree) return false;
                        });
                        if (hasFree) return false;

                        // is the model we are check in the the for free array
                        isFree = ( $.inArray(model.id, freeModel.id) !== -1 );

                        if (!hasFree && isFree) return false;
                    });
                    if (!hasFree && isFree) {
                        return parseInt(0);
                    }
                }
            }

            return parseInt(model.cost);
        };

        // No sort for ng-repeat
        $scope.notSorted = function(obj){
		    if (!obj) {
		        return [];
		    }
		    return Object.keys(obj);
		};

        // add currently selects in the URL
        $scope.updateSearch = function() {
            //get the selectedModels as string
            var search = {},
                sel = [];
            angular.forEach($scope.selectedModels, function(model) {
                var modStr = model.id;

                //an unit have an max size
                if ( model.hasOwnProperty('useMax') && model.useMax === true ) {
                    modStr += ':useMax';
                }

                //a bonded model
                if ( model.hasOwnProperty('bonded') && model.bonded === 1 ) {
                    modStr += ':bonded';
                }

                //a free model
                if ( model.hasOwnProperty('freeModel') && model.freeModel === 1 ) {
                    modStr += ':freeModel';
                }
                sel.push( modStr );
            });
            search.sel = btoa(sel);
            search.caster = $scope.gameCaster;
            search.points = $scope.gamePoints;
            search.tier = $scope.gameTier;

            $location.search( search );
        };

        // Get the selects from the URL
        $scope.restoreSearch = function() {
            var search = $location.search();
            // restore gamePoints
            if (search.points) {
                $scope.gamePoints = search.points;
            }
            //restore gameCaster
            if (search.caster) {
                $scope.gameCaster = search.caster;
            }
            // restore gameTier
            if (search.tier) {
                $scope.gameTier = search.tier;
                $scope.tier = $scope.tiers[$scope.gameTier];
            }
            //restore selectedModels
            if (search.sel) {
                var decode = atob(search.sel),
                    sel = decode.split(',');
                $.each(sel, function(key, val) {
                    $scope.addModelByString(val);
                });
            }
        };

        // adds an model by only give an string
        $scope.addModelByString = function(string) {
            //split by id an option
            var args = string.split(':');

            //search in data for id = args[0]
            var add = {};
            angular.forEach($scope.data, function(grp) {
                angular.forEach(grp.entries, function(entrie) {
                    if ( entrie.id === args[0] ) {
                        add = angular.copy(entrie);
                        return false;
                    }
                });
                if ( add.length > 0 ) {
                    return false;
                }
            });

            if (!$.isEmptyObject(add) ) {
                if ( $.inArray('bonded', args) !== -1 ) {
                    add.bonded = 1;
                }

                if ( $.inArray('useMax', args) !== -1 ) {
                    add.useMax = true;
                }

                if ( $.inArray('freeModel', args) !== -1 ) {
                    add.freeModel = 1;
                    add.cost = 0;
                }
                $scope.selectedModels.push(add);
                $scope.calculateAvailablePoints();
            }
        };

        // get model by ID
        $scope.getModelById = function(id) {
            var model = false;
            angular.forEach($scope.data, function(grp) {
                angular.forEach(grp.entries, function(entrie) {
                    if ( entrie.id === id ) {
                        model = entrie;
                        return true
                    }
                });
                if ( model ) {
                    return true;
                }
            });
            return model;
        };

        // callback if the tier changed
        $scope.changeTier = function() {
            $scope.tier = $scope.tiers[$scope.gameTier];
            $scope.clearList();
            if ( $scope.tier.hasOwnProperty('casterId') ) {
                $scope.addModelByString($scope.tier.casterId);
                $scope.accordion('1', true);
            }
        };

        // clear the complete list
        $scope.clearList = function() {
            $scope.selectedModels = [];
            $scope.calculateAvailablePoints();
        };
    }
);
