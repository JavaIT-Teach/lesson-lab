/*
 * SAMPLE LESSON — demo data for the reveal-board, drill-check, pair-mission and team-game
 * mechanics (one small stage each), plus the optional stage audioCue. Safe to delete:
 *   1. delete this file,
 *   2. delete its line in lessons/manifest.js.
 * Data only. No logic in lesson files.
 * Ids (lesson, stages, list items) are permanent: teacher edits are keyed by them. Never rename one.
 */
LL.registerLesson({
  id: "sample-mechanics",
  title: "SAMPLE — Letters game kit",
  level: "beginner",
  unit: "0",
  mainAim: "Students can say, hear and spell the 26 letter names.",
  subAims: [
    "Group letter names by vowel sound (/eɪ/, /iː/, /e/ …).",
    "Tell apart letters that sound alike (B / P / V, G / J)."
  ],
  stages: [
    {
      id: "alphabet-board",
      title: "The alphabet",
      minutes: 6,
      audioCue: "Listen: Track 1",
      mechanic: "reveal-board",
      data: {
        cue: "Listen and repeat.",
        items: [
          {
            id: "a",
            label: "Aa",
            picture: "",
            group: "ei",
            blankable: false
          },
          {
            id: "b",
            label: "Bb",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "c",
            label: "Cc",
            picture: "",
            group: "ii",
            blankable: true
          },
          {
            id: "d",
            label: "Dd",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "e",
            label: "Ee",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "f",
            label: "Ff",
            picture: "",
            group: "e",
            blankable: true
          },
          {
            id: "g",
            label: "Gg",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "h",
            label: "Hh",
            picture: "",
            group: "ei",
            blankable: true
          },
          {
            id: "i",
            label: "Ii",
            picture: "",
            group: "ai",
            blankable: false
          },
          {
            id: "j",
            label: "Jj",
            picture: "",
            group: "ei",
            blankable: true
          },
          {
            id: "k",
            label: "Kk",
            picture: "",
            group: "ei",
            blankable: false
          },
          {
            id: "l",
            label: "Ll",
            picture: "",
            group: "e",
            blankable: false
          },
          {
            id: "m",
            label: "Mm",
            picture: "",
            group: "e",
            blankable: true
          },
          {
            id: "n",
            label: "Nn",
            picture: "",
            group: "e",
            blankable: false
          },
          {
            id: "o",
            label: "Oo",
            picture: "",
            group: "ou",
            blankable: false
          },
          {
            id: "p",
            label: "Pp",
            picture: "",
            group: "ii",
            blankable: true
          },
          {
            id: "q",
            label: "Qq",
            picture: "",
            group: "uu",
            blankable: false
          },
          {
            id: "r",
            label: "Rr",
            picture: "",
            group: "aa",
            blankable: true
          },
          {
            id: "s",
            label: "Ss",
            picture: "",
            group: "e",
            blankable: false
          },
          {
            id: "t",
            label: "Tt",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "u",
            label: "Uu",
            picture: "",
            group: "uu",
            blankable: true
          },
          {
            id: "v",
            label: "Vv",
            picture: "",
            group: "ii",
            blankable: false
          },
          {
            id: "w",
            label: "Ww",
            picture: "",
            group: "uu",
            blankable: true
          },
          {
            id: "x",
            label: "Xx",
            picture: "",
            group: "e",
            blankable: false
          },
          {
            id: "y",
            label: "Yy",
            picture: "",
            group: "ai",
            blankable: true
          },
          {
            id: "z",
            label: "Zz",
            picture: "",
            group: "e",
            blankable: false
          }
        ],
        groups: [
          {
            id: "ei",
            label: "/eɪ/  like 'say'"
          },
          {
            id: "ii",
            label: "/iː/  like 'see'"
          },
          {
            id: "e",
            label: "/e/  like 'yes'"
          },
          {
            id: "ai",
            label: "/aɪ/  like 'my'"
          },
          {
            id: "ou",
            label: "/əʊ/  like 'no'"
          },
          {
            id: "uu",
            label: "/uː/  like 'you'"
          },
          {
            id: "aa",
            label: "/ɑː/  like 'car'"
          }
        ],
        blankCount: 5
      },
      rationale: {
        language: "The 26 letter names, grouped by their vowel sound (/eɪ/ A H J K, /iː/ B C D E G P T V …).",
        output: "Whole class choruses each highlighted letter, then each sound group. Then missing-item mode: pairs whisper the blanked letters to each other before the class says them together."
      },
      teacherNotes: "Play Track 3 with the board full (N steps letter by letter). Then G for groups, chorus each. Then M: five letters go blank — pairs agree, then chorus. V blanks a new five."
    },
    {
      id: "spell-it",
      title: "How do you spell it?",
      minutes: 5,
      mechanic: "drill-check",
      data: {
        mode: "step",
        commitCue: "Write it. Show your partner.",
        items: [
          {
            id: "hello",
            prompt: "hello",
            answer: "H - E - L - L - O",
            picture: "assets/sample/wave.svg",
            pairCue: "A spells it. B writes it."
          },
          {
            id: "name",
            prompt: "name",
            answer: "N - A - M - E",
            picture: "",
            pairCue: "B spells it. A writes it."
          },
          {
            id: "from",
            prompt: "from",
            answer: "F - R - O - M",
            picture: "",
            pairCue: ""
          },
          {
            id: "book",
            prompt: "book",
            answer: "B - O - O - K",
            picture: "",
            pairCue: ""
          }
        ]
      },
      rationale: {
        language: "Spelling words aloud with letter names; double letters (L-L, O-O).",
        output: "Each pair spells every word aloud and writes it down before the reveal: one spells, one writes, then they swap."
      },
      teacherNotes: "M switches to all words at once: collect every pair's spelling, then click only the words pairs disagree on."
    },
    {
      id: "letter-mingle",
      title: "Secret letter",
      minutes: 5,
      mechanic: "pair-mission",
      data: {
        mission: "Find someone with the same letter as you.",
        frame: "A: Is your letter B?\nB: No, it isn't. / Yes, it is!",
        bankCue: "Pick one. Keep it secret!",
        bank: [
          {
            id: "b",
            label: "B",
            picture: ""
          },
          {
            id: "p",
            label: "P",
            picture: ""
          },
          {
            id: "v",
            label: "V",
            picture: ""
          },
          {
            id: "d",
            label: "D",
            picture: ""
          },
          {
            id: "t",
            label: "T",
            picture: ""
          },
          {
            id: "g",
            label: "G",
            picture: ""
          },
          {
            id: "j",
            label: "J",
            picture: ""
          }
        ],
        rounds: 3,
        swapCue: "Find a new partner!",
        roundMinutes: 1
      },
      rationale: {
        language: "Is your letter …? / Yes, it is. / No, it isn't. Contrasting B / P / V, D / T, G / J.",
        output: "Every student asks and answers with at least three different partners, all at the same time."
      },
      teacherNotes: "Everyone stands. N starts each round and shows 'Find a new partner!'."
    },
    {
      id: "letter-bingo",
      title: "Letter bingo",
      minutes: 7,
      audioCue: "Optional: Track 4 for round 1",
      mechanic: "team-game",
      data: {
        instructions: "Listen. Cross out the letter you hear. Five crossed out: shout BINGO!",
        teams: [
          {
            id: "team-a",
            name: "Team A",
            score: 0
          },
          {
            id: "team-b",
            name: "Team B",
            score: 0
          }
        ],
        pool: [
          {
            id: "b",
            label: "B",
            picture: ""
          },
          {
            id: "c",
            label: "C",
            picture: ""
          },
          {
            id: "d",
            label: "D",
            picture: ""
          },
          {
            id: "e",
            label: "E",
            picture: ""
          },
          {
            id: "g",
            label: "G",
            picture: ""
          },
          {
            id: "p",
            label: "P",
            picture: ""
          },
          {
            id: "t",
            label: "T",
            picture: ""
          },
          {
            id: "v",
            label: "V",
            picture: ""
          },
          {
            id: "a",
            label: "A",
            picture: ""
          },
          {
            id: "h",
            label: "H",
            picture: ""
          },
          {
            id: "j",
            label: "J",
            picture: ""
          },
          {
            id: "k",
            label: "K",
            picture: ""
          },
          {
            id: "i",
            label: "I",
            picture: ""
          },
          {
            id: "y",
            label: "Y",
            picture: ""
          }
        ],
        shuffle: true,
        studentCaller: ""
      },
      rationale: {
        language: "Hearing and saying confusable letter names (B / P / V, G / J, E / I).",
        output: "Teams check each BINGO claim by reading the called letters aloud; in round 2 one student calls the letters."
      },
      teacherNotes: "Round 1: you call (N). Round 2: O clears the list, K hands calling to a student. Shift+1 / Shift+2 add points."
    }
  ]
});
