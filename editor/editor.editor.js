/*jshint node:true jquery:true*/
"use strict";

var clayer = require('../clayer');


module.exports = function(editor) {
	editor.Editor = function() { return this.init.apply(this, arguments); };

	editor.Editor.prototype = {
		init: function(language, $div, $toolbar) {
			this.language = language;
			this.surface = new editor.Surface($div, this);
			this.toolbar = new editor.Toolbar($toolbar, this);

			this.editables = [];
			this.editablesByLine = [];
			this.editablesEnabled = false;

			this.highlightingEnabled = false;
			this.timeHighlightingEnabled = false;
			this.activeTimeHighlights = [];

			this.autoCompletionEnabled = false;
			this.wasStepping = false;

			this.updateTimeout = null;

			this.runner = null;
			this.textChangeCallback = function(){};

			this.surface.setText('');
		},

		remove: function() {
			this.removeEditables();
			this.surface.remove();
			this.toolbar.remove();
		},

		updateSettings: function(runner, outputs) {
			this.runner = runner;
			this.outputs = outputs;
		},

		getText: function() {
			return this.code.text;
		},

		setText: function(text) {
			this.surface.setText(text);
			this.surface.resetCursor();
			this.update();
		},

		setTextChangeCallback: function(callback) {
			this.textChangeCallback = callback;
		},

		callOutputs: function(funcName) {
			// console.log(funcName);
			for (var i=0; i<this.outputs.length; i++) {
				if (this.outputs[i][funcName] !== undefined) {
					this.outputs[i][funcName].apply(this.outputs[i], [].slice.call(arguments, 1));
				}
			}
		},

		delayedUpdate: function() {
			this.code = new editor.Code(this.surface.getText());
			if (this.updateTimeout === null) {
				this.updateTimeout = setTimeout($.proxy(this.update, this), 5);
			}
		},

		update: function() {
			this.updateTimeout = null;
			this.code = new editor.Code(this.surface.getText());
			if (this.code.hasError()) {
				this.handleCriticalError(this.code.getError());
			} else {
				this.tree = new this.language.Tree(this.code.text);
				if (this.tree.hasError()) {
					this.handleCriticalError(this.tree.getError());
				} else {
					this.updateHighlighting();
					this.run();
				}
			}
			this.updateTimeHighlighting();
			this.textChangeCallback(this.code.text);
		},

		run: function() {
			this.runner.enable();
			this.runner.newTree(this.tree);
			this.updateHighlighting();
		},

		runTemp: function(text) {
			this.tree = new this.language.Tree(text);
			if (!this.tree.hasError()) {
				this.runner.newTree(this.tree);
				this.updateHighlighting();
			}
		},

		hasCriticalError: function() {
			return this.code.hasError() || this.tree.hasError();
		},

		canRun: function() {
			return !this.hasCriticalError() && !this.autoCompletionEnabled;
		},

		canHighlight: function() {
			return this.runner.isStatic() && !this.hasCriticalError();
		},

		canHighlightTime: function() {
			return this.runner.isInteractive() && this.canHighlight();
		},

		handleCriticalError: function(error) {
			if (this.editablesEnabled) {
				this.disableEditables();
			}
			this.handleError(error);
			this.runner.disable();
			this.toolbar.disable();
			this.updateHighlighting();
			this.highlightFunctionNode(null);
		},

		handleError: function(error) {
			this.surface.hideAutoCompleteBox();
			this.surface.showErrorMessage(this.makeMessageLoc(error), error.getHTML());
			this.surface.hideStepMessage();
			this.callOutputs('outputSetError', true);
		},

		handleMessages: function(messages) {
			this.callOutputs('outputSetError', false);
			this.surface.hideErrorMessage();
			var shown = false;
			for (var i=0; i<messages.length; i++) {
				if (messages[i].type === 'Inline') {
					this.surface.showStepMessage(this.makeMessageLoc(messages[i]), messages[i].getHTML());
					this.surface.scrollToLine(messages[i].getLoc(this.tree).line);
					shown = true;
				}
			}
			if (!shown) {
				this.surface.hideStepMessage();
				this.wasStepping = false;
			} else if (!this.wasStepping) {
				this.wasStepping = true;
				this.surface.openStepMessage();
			}
		},

		makeMessageLoc: function(message) {
			return this.makeLoc(message.getLoc(this.tree));
		},

		makeLoc: function(loc) {
			var output = {};
			if (loc.line2 !== undefined) {
				output.line = loc.line;
				output.line2 = loc.line2+1;
				output.column = this.code.blockToLeftColumn(loc.line, loc.line2);
				output.column2 = this.code.blockToRightColumn(loc.line, loc.line2);
			} else {
				output.line = loc.line;
				output.line2 = loc.line+1;
				output.column = loc.column;
				output.column2 = loc.column2 || loc.column;
			}
			return output;
		},

		scrollToError: function() { // callback
			this.surface.scrollToLine(this.runner.getError().getLoc(this.tree).line);
			this.surface.openErrorMessage();
		},

		userChangedText: function() { // callback
			this.update(); // refreshEditables uses this.tree
			if (this.editablesEnabled) {
				this.refreshEditables();
			}
		},

		outputRequestsRerun: function() { //callback
			if (this.canRun()) {
				this.runner.selectBaseEvent();
				return true;
			} else {
				return false;
			}
		},

		getContentLines: function() {
			return this.tree.getNodeLines();
		},

		/// RUNNER CALLBACKS ///
		startEvent: function(context) {
			this.callOutputs('outputStartEvent', context);
		},

		endEvent: function(context) {
			this.callOutputs('outputEndEvent', context);
		},

		clearAllEvents: function() {
			this.callOutputs('outputClearAllEvents');
		},

		popFirstEvent: function() {
			this.callOutputs('outputPopFirstEvent');
		},

		clearEventToEnd: function() {
			this.callOutputs('outputClearEventsToEnd');
		},

		clearEventsFrom: function(context) {
			this.callOutputs('outputClearEventsFrom', context);
		},

		runnerChanged: function() { // runner callback
			if (!this.autoCompletionEnabled) {
				this.surface.hideAutoCompleteBox();
				if (this.runner.hasError()) {
					this.handleError(this.runner.getError());
				} else {
					this.handleMessages(this.runner.getMessages());
				}
				this.updateHighlighting();
				this.toolbar.update(this.runner);
			}
			if (this.canHighlightTime()) {
				this.enableTimeHighlighting();
				if (this.activeTimeHighlights.length > 0) {
					this.updateActiveTimeHighlights();
				}
			} else {
				this.disableTimeHighlighting();
			}
			if (this.runner.isStatic()) {
				this.callOutputs('outputSetEventStep', this.runner.getEventNum(), this.runner.getStepNum());
			}
		},

		/// EDITABLES METHODS AND CALLBACKS ///
		enableEditables: function() {
			if (this.canRun()) {
				this.editablesEnabled = true;
				this.toolbar.editablesEnabled();
				this.refreshEditables();
			}
		},

		disableEditables: function() {
			this.removeEditables();
			this.editablesEnabled = false;
			this.toolbar.editablesDisabled();
		},

		refreshEditables: function() {
			if (this.editablesEnabled) {
				this.removeEditables();
				this.editables = this.language.editor.editables.generate(this.tree, editor.editables, this.surface, this);
				for (var i=0; i<this.editables.length; i++) {
					var line = this.editables[i].line;
					if (this.editablesByLine[line] === undefined) {
						this.editablesByLine[line] = [];
					}
					this.editablesByLine[line].push(this.editables[i]);
				}
			}
		},

		removeEditables: function() {
			if (this.editablesEnabled) {
				for (var i=0; i<this.editables.length; i++) {
					this.editables[i].remove();
				}
				this.editables = [];
				this.editablesByLine = [];
			}
		},

		getEditablesText: function(node) { //callback
			return this.code.rangeToText(node.textLoc);
		},

		editableReplaceCode: function(line, column, column2, newText) { // callback
			if (this.editablesByLine[line] === undefined) return;

			var offset1 = this.code.lineColumnToOffset(line, column), offset2 = this.code.lineColumnToOffset(line, column2);
			this.surface.setText(this.code.replaceOffsetRange(offset1, offset2, newText));

			var changeOffset = newText.length - (column2-column);
			if (changeOffset !== 0) {
				for (var i=0; i<this.editablesByLine[line].length; i++) {
					this.editablesByLine[line][i].offsetColumn(column, changeOffset);
				}
			}
			this.delayedUpdate();
			this.surface.restoreCursor(offset2, changeOffset);
		},

		/// HIGHLIGHTING METHODS AND CALLBACKS ///
		updateHighlighting: function() {
			if (this.highlightingEnabled) {
				if (!this.canHighlight()) {
					this.disableHighlighting();
				} else {
					var node = this.tree.getNodeByLine(this.currentHighlightLine);
					if (node !== this.currentHighlightNode) {
						this.currentHighlightNode = node;
						if (node !== null) {
							this.surface.showHighlight(this.makeLoc(node.blockLoc));
							this.callOutputs('highlightCallNodes', this.runner.getCallNodesByRange(node.blockLoc.line, node.blockLoc.line2));
						} else {
							this.surface.hideHighlight();
							this.callOutputs('highlightCallNodes', []);
						}
					}
				}
			}
		},

		enableTimeHighlighting: function() {
			if (!this.timeHighlightingEnabled && this.canHighlightTime()) {
				this.timeHighlightingEnabled = true;
				this.updateTimeHighlighting();
			}
		},

		disableTimeHighlighting: function() {
			if (this.timeHighlightingEnabled) {
				this.timeHighlightingEnabled = false;
				this.surface.hideTimeHighlights();
				this.callOutputs('highlightTimeNodes', null);
			}
		},

		updateTimeHighlighting: function() {
			if (!this.canHighlightTime()) {
				this.disableTimeHighlighting();
			} else {
				var timeHighlights = this.language.editor.timeHighlights.getTimeHighlights(this.tree);
				for (var i=0; i<this.activeTimeHighlights.length; i++) {
					if (timeHighlights[this.activeTimeHighlights[i]] === undefined) {
						this.activeTimeHighlights.splice(i--, 1);
					}
				}
				this.surface.showTimeHighlights(timeHighlights);
				if (!this.highlightingEnabled) {
					this.surface.hideInactiveTimeHighlights();
				}
			}
		},

		updateActiveTimeHighlights: function() {
			if (this.activeTimeHighlights.length > 0) {
				var nodes = [];
				var size = this.runner.getEventTotal();
				for (var i=0; i<size; i++) {
					nodes[i] = [];
				}
				var highlightsFromTree = this.language.editor.timeHighlights.getTimeHighlights(this.tree);

				for (i=0; i<this.activeTimeHighlights.length; i++) {
					var timeHighlight = highlightsFromTree[this.activeTimeHighlights[i]];
					var nodesPerContext = this.runner.getAllCallNodesByRange(timeHighlight.line, timeHighlight.line2);
					for (var j=0; j<nodesPerContext.length; j++) {
						for (var k=0; k<nodesPerContext[j].length; k++) {
							if (nodes[j].indexOf(nodesPerContext[j][k]) < 0) {
								nodes[j].push(nodesPerContext[j][k]);
							}
						}
					}
				}
				this.callOutputs('highlightTimeNodes', nodes);
			} else {
				this.callOutputs('highlightTimeNodes', null);
			}
		},

		timeHighlightHover: function(name) {
			if (!this.highlightingEnabled) {
				this.surface.hideInactiveTimeHighlights();
			}
		},

		timeHighlightActivate: function(name) {
			this.activeTimeHighlights.push(name);
			this.updateActiveTimeHighlights();
		},
		
		timeHighlightDeactivate: function(name) {
			var position = -1;
			for (var i=0; i<this.activeTimeHighlights.length; i++) {
				if (this.activeTimeHighlights[i] === name) {
					position = i;
					break;
				}
			}

			if (position > -1) {
				this.activeTimeHighlights.splice(position, 1);
				if (!this.highlightingEnabled) {
					this.surface.hideInactiveTimeHighlights();
				}
				this.updateActiveTimeHighlights();
			}
		},

		enableHighlighting: function() {
			if (this.canHighlight()) {
				this.surface.enableMouse();
				this.surface.enableHighlighting();
				this.highlightingEnabled = true;
				this.toolbar.highlightingEnabled();
				this.callOutputs('enableHighlighting');
				this.updateTimeHighlighting();
			}
		},

		disableHighlighting: function() {
			this.currentHighlightNode = null;
			this.currentHighlightLine = 0;
			this.surface.disableMouse();
			this.surface.disableHighlighting();
			this.highlightingEnabled = false;
			this.toolbar.highLightingDisabled();
			this.callOutputs('disableHighlighting');
			this.updateTimeHighlighting();
		},

		highlightNode: function(node) { // callback
			if (node !== null) {
				this.surface.showHighlight(this.makeLoc(node.lineLoc));
				this.surface.scrollToLine(node.lineLoc.line);
			} else {
				this.surface.hideHighlight();
			}
		},

		highlightNodeId: function(nodeId) { // callback
			this.highlightNode(this.tree.getNodeById(nodeId));
		},

		highlightNodeIds: function(nodeIds) { // callback
			this.surface.removeHighlights();
			for (var i=0; i<nodeIds.length; i++) {
				var node = this.tree.getNodeById(nodeIds[i]);
				this.surface.addHighlight(this.makeLoc(node.lineLoc));
			}
		},

		highlightContentLine: function(line) { // used for dare line count
			if (line === null) {
				this.highlightNode(null);
			} else {
				this.highlightNode(this.tree.getNodeByLine(line));
			}
		},

		highlightFunctionNode: function(node) { //this.runner.getFunctionNode()
			if (node === null) {
				this.surface.hideFunctionHighlight();
			} else {
				this.surface.showFunctionHighlight(this.makeLoc(node.blockLoc));
				this.surface.scrollToLine(node.blockLoc.line);
			}
		},

		click: function(event, line, column) { // callback
			this.disableAutoCompletion();
		},

		// internal method
		mouseMove: function(event, line, column) { // callback
			if (column < -1) {
				line = 0;
			}
			if (this.highlightingEnabled && this.currentHighlightLine !== line) {
				this.currentHighlightLine = line;
				this.updateHighlighting();
			}
		},

		mouseLeave: function(event) { //callback
			if (this.highlightingEnabled) {
				this.currentHighlightLine = 0;
				this.updateHighlighting();
			}
		},

		/// KEYBOARD CALLBACKS ///
		tabIndent: function(event, offset1, offset2) { // callback
			// 9 == tab key
			if (event.keyCode === 9) {
				var code = new editor.Code(this.surface.getText());
				var pos1 = code.offsetToLoc(offset1);
				var pos2 = pos1;
				if (offset2 !== offset1) {
					pos2 = code.offsetToLoc(offset2);
				}
				
				var newText = code.text.substring(0, code.lineColumnToOffset(pos1.line, 0));
				var totalOffset1 = 0, totalOffset2 = 0;

				for (var i=pos1.line; i<=pos2.line; i++) {
					var startOffset = code.lineColumnToOffset(i, 0);
					var line = code.getLine(i);
					if (!event.shiftKey) {
						// insert spaces
						newText += '  ' + line + '\n';
						if (i === pos1.line) totalOffset1 += 2;
						totalOffset2 += 2;
					} else {
						// remove spaces
						var spaces = Math.min(code.getLine(i).match(/^ */)[0].length, 2);
						newText += line.substring(spaces) + '\n';
						if (i === pos1.line) totalOffset1 -= Math.min(spaces, pos1.column);
						if (i === pos2.line) {
							totalOffset2 -= Math.min(spaces, pos2.column);
						} else {
							totalOffset2 -= spaces;
						}
					}
				}
				var finalOffset = code.lineColumnToOffset(pos2.line+1, 0);
				if (finalOffset !== null) newText += code.text.substring(finalOffset);

				this.surface.setText(newText);
				this.surface.restoreCursorRange(totalOffset1, totalOffset2);
				
				event.preventDefault();
				return true;
			} else {
				return false;
			}
		},

		// TODO: use http://archive.plugins.jquery.com/project/fieldselection
		autoIndent: function(event, offset) { // callback
			// 13 == enter, 221 = } or ]
			if ([13, 221].indexOf(event.keyCode) >= 0) {
				var code = new editor.Code(this.surface.getText());

				var pos = code.offsetToLoc(offset);
				if (pos.line > 1) {
					var prevLine = code.getLine(pos.line-1);
					var curLine = code.getLine(pos.line);

					// how many spaces are there on the previous line (reference), and this line
					var spaces = prevLine.match(/^ */)[0].length;
					var spacesAlready = curLine.match(/^ */)[0].length;

					// "{" on previous line means extra spaces, "}" on this one means less
					spaces += prevLine.match(/\{ *$/) !== null ? 2 : 0;
					spaces -= curLine.match(/^ *\}/) !== null ? 2 : 0;

					// also, since we are returning an offset, remove the number of spaces we have already
					spaces -= spacesAlready;

					var startOffset = code.lineColumnToOffset(pos.line, 0);
					if (spaces < 0) {
						// don't delete more spaces that there are on this line
						spaces = Math.max(spaces, -spacesAlready);
						this.surface.setText(code.removeOffsetRange(startOffset, startOffset-spaces));
					} else {
						this.surface.setText(code.insertAtOffset(startOffset, new Array(spaces+1).join(' ')));
					}
					this.surface.restoreCursor(startOffset, spaces);
				}
			}
		},

		autoComplete: function(event, offset) { // callback
			// 190 == ., 48-90 == alpha-num, 8 == backspace
			if (event.keyCode === 190 || (event.keyCode >= 48 && event.keyCode <= 90) || event.keyCode === 8) {
				this.code = new editor.Code(this.surface.getText());
				var pos = this.code.offsetToLoc(offset);
				if (pos.line > 0) {
					var line = this.code.getLine(pos.line);
					var match = /([A-Za-z][A-Za-z0-9]*[.])+([A-Za-z][A-Za-z0-9]*)?$/.exec(line.substring(0, pos.column));
					if (match !== null) {
						var examples = this.runner.getExamples(match[0]);
						if (examples !== null) {
							this.autoCompletionEnabled = true;
							var addSemicolon = line.substring(pos.column).replace(' ', '').length <= 0;
							this.surface.showAutoCompleteBox(pos.line, pos.column-examples.width, offset-examples.width, examples, addSemicolon);
							return;
						}
					}
				}
			}
			this.disableAutoCompletion();
		},

		previewExample: function(offset1, offset2, example) { // callback
			this.autoCompletionEnabled = true;
			if (this.editablesEnabled) {
				this.disableEditables();
			}
			if (this.highlightingEnabled) {
				this.disableHighlighting();
			}

			var text = this.surface.getText();
			this.runTemp(text.substring(0, offset1) + example + text.substring(offset2));
			this.toolbar.disable();
		},

		insertExample: function(offset1, offset2, example) { // callback
			if (this.autoCompletionEnabled) {
				var text = this.surface.getText();
				this.surface.setText(text.substring(0, offset1) + example + text.substring(offset2));
				this.surface.setCursor(offset1 + example.length, offset1 + example.length);
				this.disableAutoCompletion();
			}
		},

		disableAutoCompletion: function() {
			if (this.autoCompletionEnabled) {
				this.autoCompletionEnabled = false;
				this.delayedUpdate();
			}
		},


		addEvent: function(type, funcName, args) {
			return this.runner.addEvent(type, funcName, args);
		},

		makeInteractive: function() {
			this.runner.makeInteractive();
		}
	};
};
