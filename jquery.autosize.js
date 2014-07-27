/*!
    Modified by: Sérgio Amaral (21-07-2014)
    Based on Autosize v1.18.9 - 2014-05-27
	Minimum jQuery version: 1.9

    Automatically adjust textarea height based on user input.	
*/
(function ($) {
    var
	defaults = {
	    className: 'autosizejs',
	    id: 'autosizejs',
	    append: '\n',
	    callback: false,
	    resizeDelay: 10,
	    placeholder: true,
        sameStyles: true
	},

	// border:0 is unnecessary, but avoids a bug in Firefox on OSX
	copy = '<textarea tabindex="-1" style="position:absolute; top:-999px; left:0; right:auto; bottom:auto; border:0; padding: 0; -moz-box-sizing:content-box; -webkit-box-sizing:content-box; box-sizing:content-box; word-wrap:break-word; height:0 !important; min-height:0 !important; overflow:hidden; transition:none; -webkit-transition:none; -moz-transition:none;"/>',

	// line-height is conditionally included because IE7/IE8/old Opera do not return the correct value.
	typographyStyles = [
		'fontFamily',
		'fontSize',
		'fontWeight',
		'fontStyle',
		'letterSpacing',
		'textTransform',
		'wordSpacing',
		'textIndent'
	],

	// to keep track which textarea is being mirrored when adjust() is called.
	mirrored,

	// the mirror element, which is used to calculate what size the mirrored element should be.
	mirror = $(copy).prop('autosize', true)[0];

    // test that line-height can be accurately copied.
    mirror.style.lineHeight = '99px';
    if ($(mirror).css('lineHeight') === '99px') {
        typographyStyles.push('lineHeight');
    }
    mirror.style.lineHeight = '';

    $.fn.autosize = function (options) {
        if (!this.length) {
            return this;
        }

        options = $.extend({}, defaults, options || {});

        if (mirror.parentNode !== document.body) {
            mirror.id = options.id;
            mirror.className = options.className;
            $(document.body).append(mirror);
        }

        //Set properties in all matched elements (avoids reflows later)
        this.css({
            overflow: 'hidden',
            overflowY: 'hidden',
            wordWrap: 'break-word', 
            resize: 'none' 
        });

        var propsMap = $.map(this, function (ta) { 
            var $ta = $(ta);
            return {
                height: $ta.height(),
                outerHeight: $ta.outerHeight(),
                width: $ta.width()                
            };
        });


        var hasCallback = $.isFunction(options.callback);
        var taChangeSets = [];

        function applyChanges(ta, changes) {
            for (var prop in changes) {
                ta.style[prop] = changes[prop]
            }

            if (changes.height) {
                if (hasCallback) {
                    options.callback.call(ta, ta);
                }
            }
        }

        this.each(function (i) {
            var
			ta = this,
			$ta = $(ta),
			maxHeight,
			minHeight,
			boxOffset = 0,			
			originalStyles = {
			    height: ta.style.height,
			    overflow: ta.style.overflow,
			    overflowY: ta.style.overflowY,
			    wordWrap: ta.style.wordWrap,
			    resize: ta.style.resize
			},
			timeout,
			width = 0,
            taCss = $ta.css(typographyStyles.concat([
                'boxSizing', 'minHeight', 'maxHeight',
                'resize', 'overflow', 'overflowY', 'wordWrap'
            ])),
            props = propsMap[i];

            if ($ta.prop('autosize')) {
                // exit if autosize has already been applied, or if the textarea is the mirror element.
                return;
            }
            $ta.prop('autosize', true);

            var height = props.height;
            if (taCss.boxSizing === 'border-box') {
                boxOffset = props.outerHeight - height;
            }

            // IE8 and lower return 'auto', which parses to NaN, if no min-height is set.
            minHeight = Math.max(parseInt(taCss.minHeight, 10) - boxOffset || 0, height);

            if (taCss.overflow !== 'hidden' || taCss.overflowY !== 'hidden' || taCss.wordWrap !== 'break-word' || taCss.resize !== 'none') {
                $ta.css({
                    overflow: 'hidden',
                    overflowY: 'hidden',
                    wordWrap: 'break-word', // horizontal overflow is hidden, so break-word is necessary for handling words longer than the textarea width
                    resize: 'none' //(taCss.resize === 'both' || taCss.resize === 'horizontal' ? 'horizontal': 'none'); //Note: Disable resize on text areas
                });
            }

            function loadWidth(definedWidth) {
                if (definedWidth) width = definedWidth;
                else{
                    var newWidth = $ta.width();
                    if (newWidth !== width) {
                        width = newWidth;
                    }
                }
                return width;
            }

            function setMirrorWidth() {
                mirror.style.width = Math.max(width, 0) + 'px';
            }

            function initMirror() {
                mirrored = ta;
                maxHeight = parseInt(taCss.maxHeight, 10);
                
                if(options.sameStyles && !mirror.stylesApplied){
                    var taWrap = $ta.attr("wrap");

                    // mirror is a duplicate textarea located off-screen that
                    // is automatically updated to contain the same text as the
                    // original textarea.  mirror always has a height of 0.
                    // This gives a cross-browser supported way getting the actual
                    // height of the text, through the scrollTop property.		
                    var styles = {};
                    $.each(typographyStyles, function (i, val) {
                        styles[val] = taCss[val];
                    });

                    $(mirror).attr('wrap', taWrap).css(styles);

                    mirror.stylesApplied = true;
                }

                setMirrorWidth();

                //// Chrome-specific fix:
                //// When the textarea y-overflow is hidden, Chrome doesn't reflow the text to account for the space
                //// made available by removing the scrollbar. This workaround triggers the reflow for Chrome.
                //if (window.chrome) {
                //    var width = ta.style.width;
                //    ta.style.width = '0px';
                //    var ignore = ta.offsetWidth;
                //    ta.style.width = width;
                //}
            }            

            // Using mainly bare JS in this function because it is going
            // to fire very often while typing, and needs to very efficient.
            function adjust(init) {
                //DOM get
                var height, original, taValue;                
                loadWidth(init?props.width:null);
                
                if (!ta.value && options.placeholder) {
                    // If the textarea is empty, copy the placeholder text into 
                    // the mirror control and use that for sizing so that we 
                    // don't end up with placeholder getting trimmed.
                    taValue = ($ta.attr("placeholder") || '') + options.append;
                } else {
                    taValue = ta.value + options.append;
                }
                
                var overflowY = ta.style.overflowY;

                //DOM set
                if (mirrored !== ta) {
                    initMirror();
                } else {
                    setMirrorWidth();
                }
                
                mirror.value = taValue;
                mirror.style.overflowY = overflowY;
                original = parseInt(ta.style.height, 10);

                // Setting scrollTop to zero is needed in IE8 and lower for the next step to be accurately applied
                mirror.scrollTop = 0;

                mirror.scrollTop = 9e4;                

                //DOM get
                // Using scrollTop rather than scrollHeight because scrollHeight is non-standard and includes padding.
                height = mirror.scrollTop;

                //DOM set
                var taChanges = {};
                if (maxHeight && height > maxHeight) {
                    if (overflowY !== 'scroll')
                        taChanges.overflowY = 'scroll';
                    height = maxHeight;
                } else {
                    if (overflowY !== 'hidden')
                        taChanges.overflowY = 'hidden';
                    if (height < minHeight) {
                        height = minHeight;
                    }
                }

                height += boxOffset;

                if (original !== height) {
                    taChanges.height = height + 'px';                    
                }


                if (init && taChangeSets) {
                    if(taChanges.height)
                        taChangeSets.push({ ta: ta, changes: taChanges });
                }
                else {
                    applyChanges(ta, taChanges);
                }
            }            

            function resize() {
                clearTimeout(timeout);
                timeout = setTimeout(function () {                    
                    adjust(false);
                }, parseInt(options.resizeDelay, 10));
            }

            if ('onpropertychange' in ta) {
                if ('oninput' in ta) {
                    // Detects IE9.  IE9 does not fire onpropertychange or oninput for deletions,
                    // so binding to onkeyup to catch most of those occasions.  There is no way that I
                    // know of to detect something like 'cut' in IE9.
                    $ta.on('input.autosize keyup.autosize', adjust);
                } else {
                    // IE7 / IE8
                    $ta.on('propertychange.autosize', function () {
                        if (event.propertyName === 'value') {
                            adjust(false);
                        }
                    });
                }
            } else {
                // Modern Browsers
                $ta.on('input.autosize', adjust);
            }

            // Set options.resizeDelay to false if using fixed-width textarea elements.
            // Uses a timeout and width check to reduce the amount of times adjust needs to be called after window resize.

            if (options.resizeDelay !== false) {
                $(window).on('resize.autosize', resize);
            }

            // Event for manual triggering if needed.
            // Should only be needed when the value of the textarea is changed through JavaScript rather than user input.
            $ta.on('autosize.resize', adjust);

            // Event for manual triggering that also forces the styles to update as well.
            // Should only be needed if one of typography styles of the textarea change, and the textarea is already the target of the adjust method.
            $ta.on('autosize.resizeIncludeStyle', function () {
                mirrored = null;
                adjust(false);
            });

            $ta.on('autosize.destroy', function () {
                mirrored = null;
                clearTimeout(timeout);
                $(window).off('resize', resize);
                $ta
					.off('autosize')
					.off('.autosize')
					.css(originalStyles)
					.removeData('autosize');
            });

            // Call adjust in case the textarea already contains text.
            adjust(true);
        });

        if (taChangeSets && taChangeSets.length > 0) {
            $.each(taChangeSets, function (i, val) {
                applyChanges(val.ta, val.changes);
            });

            taChangeSets = null;
        }

        return this;
    };
}(window.jQuery || window.$)); // jQuery or jQuery-like library, such as Zepto