/*jshint node:true jquery:true*/
"use strict";

module.exports = function(output) {
	output.Console = function() { return this.init.apply(this, arguments); };

	output.Console.prototype = {
		init: function($div, editor) {
			this.$div = $div;
			this.$div.addClass('output console');
			this.$div.on('scroll', $.proxy(this.refreshAutoScroll, this));

			this.$container = $('<div class="console-container"></div>');
			this.$div.append(this.$container);

			this.$targetConsole = $('<div class="console-target"></div>');
			this.$container.append(this.$targetConsole);

			this.$content = $('<div class="console-content"></div>');
			this.$container.append(this.$content);

			this.calls = [];

			this.debugToBrowser = true;
			this.highlighting = false;
			this.highlightNextLines = false;
			this.autoScroll = false;
			this.editor = editor;
			this.editor.addOutput(this);

			this.refreshAutoScroll();
		},

		remove: function() {
			this.$content.children('.console-line').remove();
			this.$container.remove();
			this.$div.removeClass('output console');
			this.$div.off('scroll mousemove mouseleave');
			this.editor.removeOutput(this);
		},

		getAugmentedObject: function() {
			return {
				log: {
					name: 'log',
					info: 'console.log',
					type: 'function',
					example: 'log("Hello World!")',
					func: $.proxy(this.log, this)
				},
				clear: {
					name: 'clear',
					info: 'console.clear',
					type: 'function',
					example: 'clear()',
					func: $.proxy(this.clear, this)
				},
				setColor: {
					name: 'setColor',
					info: 'console.setColor',
					type: 'function',
					example: 'setColor("#a00")',
					func: $.proxy(this.setColor, this)
				}
			};
		},

		log: function(context, name, args) {
			var value = args[0];
			var text = '' + value;
			if (typeof value === 'object') text = '[object]';
			else if (typeof value === 'function') text = '[function]';
			this.text += text + '\n';

			var $element = $('<div class="console-line"></div>');
			this.$content.append($element);
			$element.data('index', this.calls.length);
			$element.text(text);
			$element.css('color', this.color);
			
			var callNr = context.getCallNr();
			this.calls.push({$element: $element, node: context.getCallNode(), callNr: callNr});

			if (this.debugToBrowser && console && console.log) console.log(value);
		},

		setColor: function(context, name, args) {
			var color = args[0];
			this.color = color;
		},

		highlightCalls: function(calls) {
			this.$content.children('.console-highlight-line').removeClass('console-highlight-line');

			for (var i=0; i<this.calls.length; i++) {
				var call = this.calls[i];
				if (calls.indexOf(call.callNr) >= 0 && call.$element !== null) {
					call.$element.addClass('console-highlight-line');
				}
			}

			var $last = this.$content.children('.console-highlight-line').last();
			if ($last.length > 0) {
				// the offset is weird since .position().top changes when scrolling
				this.scrollToY($last.position().top, true);
			}
		},

		enableHighlighting: function() {
			this.highlighting = true;
			this.$div.addClass('console-highlighting');
			this.$div.on('mousemove', $.proxy(this.mouseMove, this));
			this.$div.on('mouseleave', $.proxy(this.mouseLeave, this));
			this.autoScroll = false;
			this.$div.removeClass('console-autoscroll');
		},

		disableHighlighting: function() {
			this.highlighting = false;
			this.$content.children('.console-highlight-line').removeClass('console-highlight-line');
			this.$div.removeClass('console-highlighting');
			this.$div.off('mousemove mouseleave');
			this.refreshAutoScroll();
		},

		startRun: function() {
			// this.stopHighlighting();
			this.color = '';
			this.text = '';
			this.calls = [];
			this.$elementsByCallNr = [];
			this.$content.removeClass('console-error');
			this.$content.children('.console-line').remove(); // prevent $.data leaks
		},

		endRun: function() {
			// this.render();
		},

		hasError: function() {
			this.$content.addClass('console-error');
		},

		clear: function(context) {
			this.color = '';
			this.text = '';
			var callNr = context.getCallNr();
			this.calls.push({clear: true, callNr: callNr, $element: null});
			this.$content.children('.console-line').hide();
			
			if (this.debugToBrowser && console && console.clear) console.clear();
		},

		getText: function() {
			return this.text;
		},

		makeTargetConsole: function(content) {
			var lines = content.split('\n');
			while (lines.length > 0 && lines[lines.length-1] === '') {
				lines.pop();
			}
			for (var i=0; i<lines.length; i++) {
				var $element = $('<div class="console-line"></div>');
				$element.text(lines[i]);
				this.$targetConsole.append($element);
			}
		},

		setFocus: function() {
			this.$content.css('min-height', this.$targetConsole.height());
		},

		setCallNr: function(context, callNr) {
			this.$content.children('.console-line').hide();
			for (var i=0; i<this.calls.length; i++) {
				var call = this.calls[i];
				if (call !== undefined && call.callNr <= callNr) {
					if (call.clear) {
						this.$content.children('.console-line').hide();
					} else {
						call.$element.show();
					}
				}
			}

			if (this.autoScroll) {
				this.scrollToY(this.$content.height());
			}
		},

		/// INTERNAL FUNCTIONS ///
		scrollToY: function(y, smooth) {
			smooth = smooth || false;
			y = Math.max(0, y - this.$div.height()/2);
			this.$div.stop(true);
			if (smooth) {
				this.$div.animate({scrollTop : y}, 150);
			} else {
				this.$div.scrollTop(y);
			}
		},

		mouseMove: function(event) {
			if (this.highlighting) {
				var $target = $(event.target);
				if (this.calls[$target.data('index')] !== undefined) {
					if (!$target.hasClass('console-highlight-line')) {
						this.$content.children('.console-highlight-line').removeClass('console-highlight-line');
						$target.addClass('console-highlight-line');
						this.editor.highlightNode(this.calls[$target.data('index')].node);
					}
				} else {
					this.$content.children('.console-highlight-line').removeClass('console-highlight-line');
					this.editor.highlightNode(null);
				}
			}
		},

		mouseLeave: function(event) {
			if (this.highlighting) {
				this.$content.children('.console-highlight-line').removeClass('console-highlight-line');
				this.editor.highlightNode(null);
			}
		},

		refreshAutoScroll: function() {
			if (!this.highlighting) {
				if (this.$div.scrollTop() >= this.$content.outerHeight(true)-this.$div.height()-4) {
					this.$div.addClass('console-autoscroll');
					this.autoScroll = true;
				} else {
					this.$div.removeClass('console-autoscroll');
					this.autoScroll = false;
				}
			}
		}
	};
};
