/*
 * SAMPLE LESSON — proves the stage loop works. Safe to delete:
 *   1. delete this file,
 *   2. delete its line in lessons/manifest.js,
 *   3. delete assets/sample/.
 * Data only. No logic in lesson files.
 * Ids (lesson, stages, list items) are permanent: teacher edits are keyed by them. Never rename one.
 */
LL.registerLesson({
  id: "sample-hello",
  title: "SAMPLE — Hello, my name is…",
  level: "beginner",
  unit: "0",
  mainAim: "Students can greet someone and say their name and where they are from.",
  subAims: [
    "Use 'Hello, I'm …' and 'My name is …' with correct stress.",
    "Ask and answer 'Where are you from?'"
  ],
  stages: [
    {
      id: "warm-up",
      title: "Warm-up",
      minutes: 3,
      mechanic: "prompt-card",
      data: {
        prompt: "Say hello to three people. Say your name.",
        cue: "Stand up. Walk. Talk to three people.",
        picture: "assets/sample/wave.svg",
        pictureAlt: "A waving hand"
      },
      rationale: {
        language: "Hello. / Hi. / I'm … / My name is …",
        output: "Three short greetings with their own name, spoken to three different classmates."
      },
      teacherNotes: "Model first with one strong student. Stop after 3 minutes even if some are not finished."
    },
    {
      id: "where-from",
      title: "Where are you from?",
      minutes: 5,
      mechanic: "prompt-card",
      data: {
        prompt: "Where are you from?",
        cue: "Pairs: A asks, B answers. Then swap.",
        picture: "",
        pictureAlt: ""
      },
      rationale: {
        language: "Where are you from? / I'm from … (country and city)",
        output: "Each student asks the question and gives a full-sentence answer, twice."
      },
      teacherNotes: "Drill the question chorally first: rising energy on 'from'. Listen for 'I from' (missing 'am')."
    },
    {
      id: "introduce-partner",
      title: "Introduce your partner",
      minutes: 6,
      mechanic: "prompt-card",
      data: {
        prompt: "This is … . She's / He's from … .",
        cue: "Groups of four: introduce your partner to the others.",
        picture: "",
        pictureAlt: ""
      },
      rationale: {
        language: "This is … / He's / She's from …  (third person with 'is')",
        output: "Each student introduces their partner in two sentences to a new pair."
      },
      teacherNotes: "Board 'He's = He is'. Check pronoun choice, not accent."
    }
  ]
});
