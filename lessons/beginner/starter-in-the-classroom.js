/*
 * Beginner · Starter — In the Classroom.
 * The printed worksheet (student's book Ex 5–8, lead-in / mingle sections, 16 bingo cards) carries most
 * of the lesson; these stages show students what is happening and hold what needs a shared screen.
 * The warm-up is not here (it runs in a separate app).
 * Pictures: assets/starter-in-the-classroom/ (flat illustrations; people are drawn figures, never photos).
 * Data only. Ids (lesson, stages, list items) are permanent: teacher edits are keyed by them. Never rename one.
 */
LL.registerLesson({
  id: "starter-in-the-classroom",
  title: "In the Classroom",
  level: "beginner",
  unit: "Starter",
  mainAim: "Ss can ask for and give a name, its spelling and their age; count 1-20; name the days of the week; name classroom objects and colours.",
  subAims: [
    "Spell names aloud with the alphabet: What's your name? / How do you spell it?",
    "Ask and answer: How old are you? / I'm … .",
    "Count 1–20 and say number words, with stress on -teen (thirTEEN, fourTEEN …).",
    "Say and spell the days of the week, Monday–Sunday, in order.",
    "Name classroom objects: girl, boy, teacher, board, picture, apple, orange, pen(s), pencil(s), pencil case, ruler(s), rubber(s), book(s).",
    "Name nine colours: black, blue, brown, green, grey, orange, red, white, yellow."
  ],
  stages: [
    {
      id: "cheat-sheet-partner",
      title: "Cheat Sheet & Partner Intro",
      minutes: 5,
      mechanic: "prompt-card",
      data: {
        title: "Cheat Sheet & Partner Intro",
        steps: [
          { id: "review", text: "Review the cheat sheet." },
          { id: "ask-name", text: "Ask your partner: \"What's your name?\"" },
          { id: "ask-spell", text: "Ask: \"How do you spell it?\"" }
        ],
        cue: "Pairs — write their answer on Worksheet Part 1.",
        picture: "",
        pictureAlt: ""
      },
      rationale: {
        language: "The alphabet (letter names) + What's your name? / How do you spell it?",
        output: "Each student spells their name aloud to a partner and writes the partner's spelling on Worksheet Part 1."
      },
      teacherNotes: "One minute silent review of the Alphabet Sound Sheet first. Model with one student: ask, they spell, you write it on the board letter by letter."
    },
    {
      id: "numbers-1-20",
      title: "Numbers 1-20",
      minutes: 5,
      mechanic: "reveal-board",
      data: {
        cue: "",
        items: [
          { id: "n1", label: "1", picture: "", group: "", blankable: false },
          { id: "n2", label: "2", picture: "", group: "", blankable: false },
          { id: "n3", label: "3", picture: "", group: "", blankable: false },
          { id: "n4", label: "4", picture: "", group: "", blankable: false },
          { id: "n5", label: "5", picture: "", group: "", blankable: false },
          { id: "n6", label: "6", picture: "", group: "", blankable: false },
          { id: "n7", label: "7", picture: "", group: "", blankable: false },
          { id: "n8", label: "8", picture: "", group: "", blankable: false },
          { id: "n9", label: "9", picture: "", group: "", blankable: false },
          { id: "n10", label: "10", picture: "", group: "", blankable: false },
          { id: "n11", label: "11", picture: "", group: "", blankable: false },
          { id: "n12", label: "12", picture: "", group: "", blankable: false },
          { id: "n13", label: "13", picture: "", group: "teen", blankable: false },
          { id: "n14", label: "14", picture: "", group: "teen", blankable: false },
          { id: "n15", label: "15", picture: "", group: "teen", blankable: false },
          { id: "n16", label: "16", picture: "", group: "teen", blankable: false },
          { id: "n17", label: "17", picture: "", group: "teen", blankable: false },
          { id: "n18", label: "18", picture: "", group: "teen", blankable: false },
          { id: "n19", label: "19", picture: "", group: "teen", blankable: false },
          { id: "n20", label: "20", picture: "", group: "", blankable: false }
        ],
        groups: [
          { id: "teen", label: "-teen: 13–19" }
        ],
        blankCount: 0
      },
      rationale: {
        language: "Numbers 1–20; stress on -teen (thirTEEN vs THIRty).",
        output: "Spoken counting, live: students count off around the room, then chorus the numbers the teacher highlights."
      },
      teacherNotes: "Count-off happens first, off-screen: students count themselves around the room. Then use the board: N / B step 11 → 20 one by one; G highlights the -teen set (13–19) to drill the stress; O clears."
    },
    {
      id: "meet-classmates",
      title: "Meet Your Classmates",
      minutes: 8,
      mechanic: "pair-mission",
      data: {
        mission: "Stand up. Ask at least 3 classmates: What's your name? / How do you spell it? / How old are you? Write their answers on Worksheet Part 2.",
        frame: "A: What's your name?\nB: I'm … / My name's … .\nA: How do you spell it?\nB: …\nA: How old are you?\nB: I'm … .",
        bankCue: "",
        bank: [],
        rounds: 3,
        swapCue: "Find a new classmate!",
        roundMinutes: 0
      },
      rationale: {
        language: "What's your name? / How do you spell it? / How old are you? and the answers (I'm … / My name's …).",
        output: "A written record of at least 3 classmates' names, spellings and ages on Worksheet Part 2 — real listening, because the answers are not known in advance."
      },
      teacherNotes: "Everyone stands. N calls each swap. Fast finishers: a 4th and 5th classmate. Real names and ages only — no invented identities."
    },
    {
      id: "birthday-cakes",
      title: "Birthday Cakes",
      minutes: 3,
      mechanic: "drill-check",
      data: {
        mode: "step",
        commitCue: "Check with your partner first.",
        items: [
          { id: "cake-a", prompt: "Cake A", answer: "nine", picture: "assets/starter-in-the-classroom/cake-a.svg", pairCue: "Check your Worksheet Part 3 answers." },
          { id: "cake-b", prompt: "Cake B", answer: "seventeen", picture: "assets/starter-in-the-classroom/cake-b.svg", pairCue: "Check your Worksheet Part 3 answers." },
          { id: "cake-c", prompt: "Cake C", answer: "twelve", picture: "assets/starter-in-the-classroom/cake-c.svg", pairCue: "Check your Worksheet Part 3 answers." },
          { id: "cake-d", prompt: "Cake D", answer: "fourteen", picture: "assets/starter-in-the-classroom/cake-d.svg", pairCue: "Check your Worksheet Part 3 answers." },
          { id: "cake-e", prompt: "Cake E", answer: "eight", picture: "assets/starter-in-the-classroom/cake-e.svg", pairCue: "Check your Worksheet Part 3 answers." },
          { id: "cake-f", prompt: "Cake F", answer: "eleven", picture: "assets/starter-in-the-classroom/cake-f.svg", pairCue: "Check your Worksheet Part 3 answers." }
        ]
      },
      rationale: {
        language: "Number words (eight – seventeen); How old are you? / I'm … .",
        output: "Self- and pair-checked written answers: students compare their Worksheet Part 3 answers with a partner, then check each reveal."
      },
      teacherNotes: "Ex 5 answer check only — students already wrote answers on paper. A = nine is the example. Candles are in groups of five. M shows all at once: reveal only the ones pairs disagree on."
    },
    {
      id: "how-old-are-you",
      title: "How Old Are You?",
      minutes: 3,
      audioCue: "Listen: Track 5",
      mechanic: "drill-check",
      data: {
        mode: "step",
        commitCue: "Check with your partner first.",
        items: [
          { id: "ex6-ryan", prompt: "Ryan", answer: "Cake D", picture: "", pairCue: "Ex 6 · after Track 5" },
          { id: "ex6-penny", prompt: "Penny", answer: "Cake B", picture: "", pairCue: "Ex 6 · after Track 5" },
          { id: "ex6-jack", prompt: "Jack", answer: "Cake A", picture: "", pairCue: "Ex 6 · after Track 5" },
          { id: "ex6-david", prompt: "David", answer: "Cake F", picture: "", pairCue: "Ex 6 · after Track 5" },
          { id: "ex6-anna", prompt: "Anna", answer: "Cake E", picture: "", pairCue: "Ex 6 · after Track 5" },
          { id: "ex6-lara", prompt: "Lara", answer: "Cake C", picture: "", pairCue: "Ex 6 · after Track 5" }
        ]
      },
      rationale: {
        language: "Number words (eight – seventeen); How old are you? / I'm … .",
        output: "Self- and pair-checked written answers: students compare their Ex 6 answers with a partner, then check each reveal."
      },
      teacherNotes: "Ex 6 answer check only. Play Track 5, then reveal Ryan → Penny → Jack → David → Anna → Lara. M shows all at once: reveal only the ones pairs disagree on."
    },
    {
      id: "bingo",
      title: "Bingo",
      minutes: 8,
      mechanic: "team-game",
      data: {
        instructions: "Listen. Cross out the number on your card. Tell me how many you have!",
        teams: [],
        pool: [
          { id: "n1", label: "one", picture: "" },
          { id: "n2", label: "two", picture: "" },
          { id: "n3", label: "three", picture: "" },
          { id: "n4", label: "four", picture: "" },
          { id: "n5", label: "five", picture: "" },
          { id: "n6", label: "six", picture: "" },
          { id: "n7", label: "seven", picture: "" },
          { id: "n8", label: "eight", picture: "" },
          { id: "n9", label: "nine", picture: "" },
          { id: "n10", label: "ten", picture: "" },
          { id: "n11", label: "eleven", picture: "" },
          { id: "n12", label: "twelve", picture: "" },
          { id: "n13", label: "thirteen", picture: "" },
          { id: "n14", label: "fourteen", picture: "" },
          { id: "n15", label: "fifteen", picture: "" },
          { id: "n16", label: "sixteen", picture: "" },
          { id: "n17", label: "seventeen", picture: "" },
          { id: "n18", label: "eighteen", picture: "" },
          { id: "n19", label: "nineteen", picture: "" },
          { id: "n20", label: "twenty", picture: "" }
        ],
        shuffle: true,
        studentCaller: ""
      },
      rationale: {
        language: "Number words 1–20, by ear.",
        output: "Each student says their bingo count aloud (\"I have four!\") at checkpoints; a winner reads back their numbers."
      },
      teacherNotes: "Students use their own pre-printed paper cards (16 cards). N calls the next number; the screen shows it as a WORD. Say it aloud, don't show the digit. Every 5 calls: 'How many do you have?' — students answer."
    },
    {
      id: "days-order",
      title: "Days — Answer Check",
      minutes: 4,
      audioCue: "Listen: Track 6",
      mechanic: "drill-check",
      data: {
        mode: "all",
        commitCue: "Write the order on Worksheet Part 4 first.",
        items: [
          { id: "monday", prompt: "1st", answer: "Monday", picture: "", pairCue: "" },
          { id: "tuesday", prompt: "2nd", answer: "Tuesday", picture: "", pairCue: "" },
          { id: "wednesday", prompt: "3rd", answer: "Wednesday", picture: "", pairCue: "" },
          { id: "thursday", prompt: "4th", answer: "Thursday", picture: "", pairCue: "" },
          { id: "friday", prompt: "5th", answer: "Friday", picture: "", pairCue: "" },
          { id: "saturday", prompt: "6th", answer: "Saturday", picture: "", pairCue: "" },
          { id: "sunday", prompt: "7th", answer: "Sunday", picture: "", pairCue: "" }
        ]
      },
      rationale: {
        language: "The days of the week, Monday–Sunday, in order.",
        output: "Self-checked written order on Worksheet Part 4."
      },
      teacherNotes: "Reveal/check only. Students write their order, then play Track 6, then reveal in order: V (1st), N, V … (Shift+V shows all)."
    },
    {
      id: "days-spelling",
      title: "Days — Spelling Correction",
      minutes: 5,
      mechanic: "drill-check",
      data: {
        mode: "step",
        commitCue: "What's wrong? Say it correctly.",
        items: [
          { id: "monday", prompt: "Mundey", answer: "Monday", picture: "", pairCue: "" },
          { id: "tuesday", prompt: "Tuseday", answer: "Tuesday", picture: "", pairCue: "" },
          { id: "wednesday", prompt: "Wendsday", answer: "Wednesday", picture: "", pairCue: "" },
          { id: "thursday", prompt: "Thersday", answer: "Thursday", picture: "", pairCue: "" },
          { id: "friday", prompt: "Firday", answer: "Friday", picture: "", pairCue: "" },
          { id: "saturday", prompt: "Satrday", answer: "Saturday", picture: "", pairCue: "" },
          { id: "sunday", prompt: "Sundey", answer: "Sunday", picture: "", pairCue: "" }
        ]
      },
      rationale: {
        language: "Spelling of the days of the week (letter names).",
        output: "One spoken correction per called student (spelling the day letter by letter), then the class checks the reveal."
      },
      teacherNotes: "Call a student by name, they spell the correct form aloud; V reveals. Everyone else checks against their own Worksheet Part 4."
    },
    {
      id: "classroom-objects",
      title: "Classroom Objects",
      minutes: 5,
      mechanic: "reveal-board",
      data: {
        cue: "Listen and repeat.",
        items: [
          { id: "girl", label: "girl", picture: "assets/starter-in-the-classroom/girl.svg", group: "", blankable: false },
          { id: "teacher", label: "teacher", picture: "assets/starter-in-the-classroom/teacher.svg", group: "", blankable: false },
          { id: "board", label: "board", picture: "assets/starter-in-the-classroom/board.svg", group: "", blankable: false },
          { id: "apple", label: "apple", picture: "assets/starter-in-the-classroom/apple.svg", group: "", blankable: false },
          { id: "rubbers", label: "rubbers", picture: "assets/starter-in-the-classroom/rubbers.svg", group: "", blankable: false },
          { id: "orange", label: "orange", picture: "assets/starter-in-the-classroom/orange.svg", group: "", blankable: false },
          { id: "picture", label: "picture", picture: "assets/starter-in-the-classroom/picture.svg", group: "", blankable: false },
          { id: "rulers", label: "rulers", picture: "assets/starter-in-the-classroom/rulers.svg", group: "", blankable: false },
          { id: "pens", label: "pens", picture: "assets/starter-in-the-classroom/pens.svg", group: "", blankable: false },
          { id: "pencils", label: "pencils", picture: "assets/starter-in-the-classroom/pencils.svg", group: "", blankable: false },
          { id: "pencil-case", label: "pencil case", picture: "assets/starter-in-the-classroom/pencil-case.svg", group: "", blankable: false },
          { id: "boy", label: "boy", picture: "assets/starter-in-the-classroom/boy.svg", group: "", blankable: false },
          { id: "books", label: "books", picture: "assets/starter-in-the-classroom/books.svg", group: "", blankable: false }
        ],
        groups: [],
        blankCount: 0
      },
      rationale: {
        language: "Classroom object vocabulary (girl, boy, teacher, board, picture, apple, orange, pens, pencils, pencil case, rulers, rubbers, books), singular and plural.",
        output: "Choral repetition of each word after the teacher's model, as each picture is highlighted."
      },
      teacherNotes: "N steps one at a time: model, class repeats twice. Note the plurals (rubbers, rulers, pens, pencils, books). Optional: M blanks pictures for 'What's missing?'."
    },
    {
      id: "colours-ttt",
      title: "Colours — Test-Teach-Test",
      minutes: 6,
      mechanic: "drill-check",
      data: {
        mode: "step",
        commitCue: "Say the colour!",
        items: [
          { id: "black", prompt: "What colour is it?", answer: "black", picture: "assets/starter-in-the-classroom/colour-black.svg", pairCue: "" },
          { id: "blue", prompt: "What colour is it?", answer: "blue", picture: "assets/starter-in-the-classroom/colour-blue.svg", pairCue: "" },
          { id: "brown", prompt: "What colour is it?", answer: "brown", picture: "assets/starter-in-the-classroom/colour-brown.svg", pairCue: "" },
          { id: "green", prompt: "What colour is it?", answer: "green", picture: "assets/starter-in-the-classroom/colour-green.svg", pairCue: "" },
          { id: "grey", prompt: "What colour is it?", answer: "grey", picture: "assets/starter-in-the-classroom/colour-grey.svg", pairCue: "" },
          { id: "orange", prompt: "What colour is it?", answer: "orange", picture: "assets/starter-in-the-classroom/colour-orange.svg", pairCue: "" },
          { id: "red", prompt: "What colour is it?", answer: "red", picture: "assets/starter-in-the-classroom/colour-red.svg", pairCue: "" },
          { id: "white", prompt: "What colour is it?", answer: "white", picture: "assets/starter-in-the-classroom/colour-white.svg", pairCue: "" },
          { id: "yellow", prompt: "What colour is it?", answer: "yellow", picture: "assets/starter-in-the-classroom/colour-yellow.svg", pairCue: "" }
        ]
      },
      rationale: {
        language: "Colour vocabulary: black, blue, brown, green, grey, orange, red, white, yellow.",
        output: "Spoken colour name for each swatch (test, teach if needed, test again), then the confirmed spelling on reveal."
      },
      teacherNotes: "Test: show the swatch, class says the colour. Teach any they miss, then test again. V reveals the spelling."
    },
    {
      id: "colours-stroop",
      title: "Colours — Say the Colour, Not the Word",
      minutes: 4,
      mechanic: "reveal-board",
      data: {
        cue: "Say the COLOUR, not the word!",
        items: [
          { id: "black", label: "BLACK", picture: "", group: "", blankable: false, textColor: "#ffd400" } /* ink: yellow */,
          { id: "blue", label: "BLUE", picture: "", group: "", blankable: false, textColor: "#e0201b" } /* ink: red */,
          { id: "brown", label: "BROWN", picture: "", group: "", blankable: false, textColor: "#8c8c8c" } /* ink: grey */,
          { id: "green", label: "GREEN", picture: "", group: "", blankable: false, textColor: "#ff8a00" } /* ink: orange */,
          { id: "grey", label: "GREY", picture: "", group: "", blankable: false, textColor: "#7b4a1e" } /* ink: brown */,
          { id: "orange", label: "ORANGE", picture: "", group: "", blankable: false, textColor: "#141414" } /* ink: black */,
          { id: "red", label: "RED", picture: "", group: "", blankable: false, textColor: "#1f9a45" } /* ink: green */,
          { id: "white", label: "WHITE", picture: "", group: "", blankable: false, textColor: "#1f5fd6" } /* ink: blue */,
          { id: "yellow", label: "YELLOW", picture: "", group: "", blankable: false, textColor: "#ffffff" } /* ink: white */
        ],
        groups: [],
        blankCount: 0
      },
      rationale: {
        language: "Colour vocabulary, with reading automaticity (the printed word interferes).",
        output: "Choral spoken colour naming under interference: the class says the ink colour of each highlighted word."
      },
      teacherNotes: "Model one: BLACK in yellow ink → 'yellow!'. N steps one at a time; the class says the INK colour together. Second pass: faster."
    }
  ]
});
