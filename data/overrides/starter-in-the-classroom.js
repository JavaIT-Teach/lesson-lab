/*
 * Teacher edits (overrides) for lesson "starter-in-the-classroom".
 * Written by Lesson Lab. Do not hand-edit. Before changing the lesson file,
 * fold these into it with: node tools/fold-overrides.js starter-in-the-classroom
 */
window.LL = window.LL || {};
window.LL.overrides = window.LL.overrides || {};
window.LL.overrides["starter-in-the-classroom"] = {
  "lesson": "starter-in-the-classroom",
  "format": 1,
  "resetAt": 0,
  "updatedAt": 1790783471054,
  "entries": {
    "stages[cheat-sheet-partner].textStyle": {
      "op": "set",
      "v": {
        "data.cue": {
          "x": 51,
          "y": 88.9
        }
      },
      "t": 1790778127130,
      "by": "device-u4chzx"
    },
    "stages[meet-classmates].data.mission": {
      "op": "set",
      "v": "1. What's your name? \n2. How do you spell it? \n3. How old are you? \n4. Write their answers on Worksheet Part 2.",
      "t": 1790778779813,
      "by": "device-u4chzx"
    },
    "stages[meet-classmates].textStyle": {
      "op": "set",
      "v": {
        "data.mission": {
          "align": "left",
          "size": 2.2
        },
        "decorations[shape-mjfljj].label": {
          "size": 2.2
        },
        "decorations[shape-lxw32z].label": {
          "size": 1.75
        }
      },
      "t": 1790783465572,
      "by": "device-u4chzx"
    },
    "stages[meet-classmates].decorations": {
      "op": "set",
      "v": [
        {
          "id": "shape-lxw32z",
          "shape": "rectangle",
          "x": 76.2,
          "y": 41.1,
          "w": 42.5,
          "h": 13,
          "label": "Ask Your Classmates:"
        }
      ],
      "t": 1790783455409,
      "by": "device-u4chzx"
    },
    "stages": {
      "op": "none",
      "t": 1790783471054,
      "by": "device-u4chzx"
    }
  }
};
