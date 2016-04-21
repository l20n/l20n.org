define("ace/mode/ft_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var FtHighlightRules = function() {

    this.$rules = {
        "start" : [
            {
                token : "comment",
                regex : /#.*$/
            },
            {
                token : "keyword",
                regex : /\*?\[.*]/,
                push  : "value"
            },
            {
                token : "entity.name.tag",
                regex : /(.*=)\s*$/,
            },
            {
                token : "entity.name.tag",
                regex : /(.*=)/,
                push  : "value"
            },
            {
                regex : /\|/,
                token : "string",
                push : "value"
            },
            {
                defaultToken: "string"
            }
        ],
        "placeable" : [
            {
                token : "entity.other",
                regex : /^\s*\*?\[.*]/,
                push  : "value"
            },
            {
                regex : /{/,
                token : "variable.parameter",
                push : "placeable"
            },
            {
                regex : /}/,
                token : "variable.parameter",
                next : "pop"
            },
            {
                defaultToken: "variable.parameter"
            }
        ],
        "value" : [
            {
                regex : /{/,
                token : "variable.parameter",
                push : "placeable"
            },
            {
                regex : /^/,
                token : "string",
                next : "pop"
            },
            {
                defaultToken: "string"
            }
        ],
    };

    this.normalizeRules();

};

oop.inherits(FtHighlightRules, TextHighlightRules);

exports.FtHighlightRules = FtHighlightRules;
});

define("ace/mode/ft",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/ft_highlight_rules"], function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var FtHighlightRules = require("./ft_highlight_rules").FtHighlightRules;

var Mode = function() {
    this.HighlightRules = FtHighlightRules;
};
oop.inherits(Mode, TextMode);

(function() {
    this.$id = "ace/mode/ft";
}).call(Mode.prototype);

exports.Mode = Mode;
});
