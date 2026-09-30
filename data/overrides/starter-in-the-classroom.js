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
  "updatedAt": 1790778836585,
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
          "align": "left"
        },
        "decorations[shape-mjfljj].label": {
          "size": 2.2
        }
      },
      "t": 1790778836585,
      "by": "device-u4chzx"
    },
    "stages[meet-classmates].decorations": {
      "op": "set",
      "v": [
        {
          "id": "shape-mjfljj",
          "shape": "rectangle",
          "x": 76,
          "y": 23.5,
          "w": 70,
          "h": 17.5,
          "label": "Ask at least 3 classmates: "
        }
      ],
      "t": 1790778806365,
      "by": "device-u4chzx"
    }
  }
};
