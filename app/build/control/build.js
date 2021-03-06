﻿'use strict';

// Wildcard Filter for Army List builder
armyBuilder.filter('wildcardArmy', function () {
    return function (models, search) {
        if (typeof search !== 'undefined') {
            var searchRegEx = search.replace(/[^A-za-zÄÖÜäöü?]/g, '.*?');
            var thisRegex = new RegExp('.*?' + searchRegEx + '.*?', 'i');

            models = $.grep(models, function (model) {
                return thisRegex.test(model.name);
            });
        }
        return models;
    };
});

// Filter the model who not have the restricted_to model
armyBuilder.filter('restricted', function () {
    return function (models, $scope) {
        models = $.grep(models, function(model) {
            if ( model.hasOwnProperty('restricted_to') ) {

                if (typeof model.restricted_to === 'string') {
                    if ($scope.getModelById(model.restricted_to) || model.restricted_to === '*') {
                        return true;
                    }
                } else {
                    var found = false;
                    $.each(model.restricted_to, function(id, val) {
                        if ( $scope.getModelById(val) ) {
                            found = true;
                            return found;
                        }
                    });
                    return found;
                }
                return false;
            }
            return true;
        });
        return models;
    };
});

// Controller to display the troop creator
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

                $scope.tiers            = data.tiers;
                $scope.tier             = {};
                $scope.tierLevel        = 0;
                $scope.selectedModels   = [];
                $scope.gameCaster       = 1;
                $scope.gamePoints       = 20;
                $scope.gameTier         = 0;
                $scope.modlaLevel       = 0;
                $scope.points           = 0;
                $scope.dropModel        = {};
                $scope.casterPoints     = 0;
                $scope.costAlterations  = [];
                $scope.faAlterations    = [];
                $scope.freeModels       = [];
                $scope.faction          = $('#' + $routeParams.army).data('faction');
                $scope.factionId        = 'faction_' + $routeParams.army;
                $scope.system           = $('#' + $routeParams.army).data('system');
                $scope.location         = $location;


                // Now we get the mercenarys and minions
                $.each(['minion', 'mercenary'], function (k, v) {
                    if ( v !== $routeParams.army ) {
                        $http.get('./data/' + v + '.json').
                        success(
                            function (data) {
                                // Only who works for the faction get in list
                                $.each(data.groups, function (gkey, group) {
                                    if (group.entries.length !== 0) {
                                        // We clone the actual group to modify entries

                                        // Now we check all models if he work for the faction
                                        group.entries = $.grep(group.entries, function (item) {
                                            if (item.works_for) {
                                                // We have an caster, unit or solo and must look if he works_for this faction
                                                if ($.inArray($scope.factionId, item.works_for) !== -1) {
                                                    return true;
                                                }
                                            } else if (item.restricted_to) {
                                                // We have an restricted model but not all data fetched we save reference for later
                                                return true;
                                            }
                                            return false;
                                        });
                                        group.add = v;
                                        $scope.data.push(group);
                                    }
                                });

                                if ( v === 'mercenary' || $routeParams.army === 'mercenary' ) {
                                    //restore from URL after we load the last data
                                    $scope.restoreSearch();
                                }
                            }
                        ). error (
                            function (data) {
                                alert('error reading ' + v + '.json');
                            }
                        );
                    }
                });



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

        $scope.openList = function() {
            $('#left-col-build').toggleClass('active');
        };

        // Check if model an warcaster/warlock
        $scope.checkIsCaster = function(model) {
            return /^warcaster$|^warlock$/i.test(model.type);
        };

		// Check if this model available
		$scope.checkModelAvailable = function(model) {
            var cost = $scope.getModelCost(model, true),
                getFa = $scope.getModelFa(model);

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
            if ( /^warlock$|^warcaster$/i.test(model.type) && $scope.countType('^warlock$|^warcaster$') >= $scope.gameCaster ) {
				return true;
            }

			// No Caster in selectedModels we can not select an Warbeast or Warjack
            if ( /warbeast|warjack/i.test(model.type) && $scope.countType('^warlock$|^warcaster$') === 0 ) {
				return true;
            }

            // The Points to use are higher as the available points but check if warbeast an we have available caster points
            if ( /^warbeast$|^warjack$/i.test(model.type) && parseInt($scope.casterPoints) > 0) {
		    	if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) + parseInt($scope.casterPoints) ) < cost) {
		            return true;
				}
            } else if ( !$scope.checkIsCaster(model) ) {
                if ( ( parseInt($scope.gamePoints) - parseInt($scope.points) ) < cost) {
                    return true;
                }
            }

            // Check if field allowance at cap
            if ( !getFa || getFa !== 'U' ) {
            	var mc = 0;
            	var fa = false;

            	$.each($scope.selectedModels, function(k, selectedModel) {
                    // if Character and we always have in list
                    if (getFa === 'C' && selectedModel.name === model.name) {
                        fa = true;
                        return false;
                    }

                    // Count field allowance model but not the free models
                    if (selectedModel.name === model.name && !selectedModel.hasOwnProperty('freeModel')) {
                        mc++;
                    }

                    // if field allowance model full
                    if (getFa <= mc) {
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

                // If type warbeast or warjack we must add it after the last warbeast/warjack or after the last warlock/warcaster
                // If baseUnit set we must add this model to an unit
                var findIndex = false;
                if (/^warbeast$|^warjack$/i.test(model.type)) {
                    for (var i = $scope.selectedModels.length - 1; i >= 0; i--) {
                        if (/^warbeast$|^warlock$|^warjack$|^warcaster$/i.test($scope.selectedModels[i].type)) {
                            findIndex = i;
                            break;
                        }
                    }
                } else if (model.hasOwnProperty('restricted_to')) {
                    var count = $scope.selectedModels.length - 1
                    for (var i = 0; i <= count; i++) {
                        if ($scope.selectedModels[i].id === model.restricted_to) {
                            if (i !== count && $scope.selectedModels[(i + 1)].id !== model.id) {
                                findIndex = i;
                                break;
                            } else if ( i === count ) {
                                findIndex = i;
                            }
                        }
                    }
                }

                // check if the model we add an free model but only if tier
                if ( $scope.tier ) {
                    var cost = $scope.getModelCost(model, true);
                    if ( cost === 0 ) {
                        copy.realCost = copy.cost;
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
        $scope.calculateAvailablePoints = function(noUpdateSearch) {
            if ( typeof(noUpdateSearch) === 'undefined' ) noUpdateSearch = false;
            if ( !noUpdateSearch ) {
                $scope.updateSearch();
            }
            $scope.calculateTierLevel();
            $scope.checkFreeSelected();

			var sumPoints = 0;
			var casterPoints = 0;

			$.each( $scope.selectedModels, function( key, model ) {
                // Change the cost to the tier bonus cost
                var cost = $scope.getModelCost(model);

				if ( /^warlock$|^warcaster$/i.test(model.type) ) {
                    casterPoints = casterPoints + parseInt(cost);
				} else if ( /^warjack$|^warbeast$/i.test(model.type) ) {
                    casterPoints = casterPoints - cost;
				} else {
                    sumPoints = sumPoints + cost;
				}
			});

			if ( casterPoints < 0 ) {
				$scope.points = sumPoints - ( casterPoints * +1 );
			} else {
				$scope.points = sumPoints;
			}

            // Set the available Caster points for later Checks
            $scope.casterPoints = casterPoints;
		};

        // Calculate the tier level
        $scope.calculateTierLevel = function() {
            if ( $scope.tier && $scope.tier.hasOwnProperty('levels') ) {
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
            if ( level.faAlterations.length > 0 ) {
                $.each(level.faAlterations, function(key, fa) {
                    if ( fa.forEach ) {
                        var eachBonus = 0;
                        $.each($scope.selectedModels, function(idx, selectedModel) {
                            // if we have the model in list by Id
                            if ( $.inArray(selectedModel.id, fa.forEach ) !== -1 ) {
                                eachBonus ++;
                            }
                        });
                        $scope.faAlterations[fa.id] = eachBonus;
                    } else {
                        $scope.faAlterations[fa.id] = fa.bonus;
                    }
                });
            }
        };

        // reset the Tier Bonus
        $scope.resetTierBonus = function() {
            $scope.costAlterations = [];
            $scope.freeModels = [];
            $scope.faAlterations = [];
        };

        // Check Free Models in selected
        $scope.checkFreeSelected = function() {
            $.each($scope.selectedModels, function(idx, selectedModel) {
                if ( selectedModel.hasOwnProperty('freeModel') ) {
                    var isFree = true;
                    if ($scope.freeModels.length > 0 ) {
                        $.each($scope.freeModels, function (key, freeModel) {
                            // is the model we are check in the for free array
                            isFree = ( $.inArray(selectedModel.id, freeModel.id) !== -1 );
                            return !isFree;
                        });
                    } else {
                        isFree = false;
                    }

                    if ( !isFree ) {
                        $scope.selectedModels[idx].cost = $scope.selectedModels[idx].realCost;
                        delete $scope.selectedModels[idx].freeModel;
                        delete $scope.selectedModels[idx].realCost;
                    }
                }
            });
        };

        // get the real model cost
        $scope.getModelCost = function(model, checkFree, checkMax) {
            if ( typeof(checkFree) === 'undefined' ) checkFree = false;
            if ( typeof(checkMax) === 'undefined' ) checkMax = false;

            if ( ( checkMax && model.hasOwnProperty('costMax') ) || ( model.hasOwnProperty('useMax') && model.useMax ) ) {
                var rCost = parseInt(model.costMax);
            } else {
                var rCost = parseInt(model.cost);
            }

            // only run this checks if we have an tier
            if ( $scope.tier ) {
                // Check for bonus points for Models
                var bonus = $scope.costAlterations[model.id];
                if (bonus) {
                    rCost -= bonus;
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

                        // is the model we are check in the for free array
                        isFree = ( $.inArray(model.id, freeModel.id) !== -1 );

                        if (!hasFree && isFree) return false;
                    });
                    if (!hasFree && isFree) {
                        rCost = parseInt(0);
                    }
                }
            }

            return rCost;
        };

        // get the real model FA
        $scope.getModelFa = function(model) {
            // only run this checks if we have an tier and not an character
            var fa = model.fa;
            if ( $scope.tier && model.fa && model.fa !== 'C') {
                // Check for bonus FA for Models
                var bonus = $scope.faAlterations[model.id];
                if (bonus) {
                    fa = parseInt(model.fa) + parseInt(bonus);
                }
            }

            // number over 100 mens this model is unlimited
            if ( fa > 100 ) {
                fa = 'U';
            }

            // no val means this model is an Character
            if ( !fa ) {
                fa = 'C';
            }

            return fa;
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
            search.tier = $scope.gameTier === 0 ? '' : $scope.gameTier;

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
                    add.realCost = add.cost;
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

        // Try save the link in bookmark
        $scope.saveListAsFav = function() {
            var bookmarkURL = window.location.href;
            var bookmarkTitle = document.title;

            if ('addToHomescreen' in window && window.addToHomescreen.isCompatible) {
                // Mobile browsers
                addToHomescreen({ autostart: false, startDelay: 0 }).show(true);
            } else if (window.sidebar && window.sidebar.addPanel) {
                // Firefox version < 23
                window.sidebar.addPanel(bookmarkTitle, bookmarkURL, '');
            } else if ((window.sidebar && /Firefox/i.test(navigator.userAgent)) || (window.opera && window.print)) {
                // Firefox version >= 23 and Opera Hotlist
                $(this).attr({
                    href: bookmarkURL,
                    title: bookmarkTitle,
                    rel: 'sidebar'
                }).off(e);
                return true;
            } else if (window.external && ('AddFavorite' in window.external)) {
                // IE Favorite
                window.external.AddFavorite(bookmarkURL, bookmarkTitle);
            } else {
                // Other browsers (mainly WebKit - Chrome/Safari)
                alert('Press ' + (/Mac/i.test(navigator.userAgent) ? 'Cmd' : 'Ctrl') + '+D to bookmark this page.');
            }

            return false;
        };
    }
);
