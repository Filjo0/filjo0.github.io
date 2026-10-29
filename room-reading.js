// Original reading notes; source links open only after a deliberate activation.
export const readingCategories=[["apps", "Building apps"], ["quality", "Quality & testing"], ["accessibility", "Accessibility"], ["product", "Product & design"], ["maths", "Mathematics"], ["sport", "Sport & coaching"]];
export const readings=[
  {
    "id": "eloquent-book",
    "catalogueId": "apps-1",
    "kind": "Book",
    "title": "Eloquent JavaScript (4th edition)",
    "author": "Marijn Haverbeke",
    "authorShort": "Marijn Haverbeke",
    "publisher": "No Starch Press; author-hosted web edition",
    "intro": "Learn JavaScript by making things, then asking why they work. Haverbeke combines explanations with exercises, so a chapter can become a small, practical experiment rather than another tutorial to watch.",
    "keyIdeas": [
      "Functions name useful operations so you can reuse them without repeating their steps.",
      "Local scope creates boundaries that help you reason about what can change.",
      "An abstraction is useful when it makes the program easier to understand."
    ],
    "prompt": "Write a minutes-to-duration function. Try zero, one and a large value. Use it in two sentences: which assumptions belong inside the function?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Chapter 3: Functions",
      "url": "https://eloquentjavascript.net/03_functions.html",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:32.787293+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.570866+00:00"
    },
    "category": "apps",
    "source": "https://eloquentjavascript.net/",
    "displayTitle": "Eloquent JavaScript",
    "byline": "Marijn Haverbeke",
    "subtitle": "(4th edition)"
  },
  {
    "id": "apps-2",
    "kind": "Book",
    "title": "The Pragmatic Programmer, 20th Anniversary Edition",
    "author": "David Thomas and Andrew Hunt",
    "authorShort": "David Thomas and Andrew Hunt",
    "publisher": "Addison-Wesley, by arrangement with The Pragmatic Bookshelf",
    "intro": "This is a book about the decisions and habits behind software, rather than a particular framework. Its short sections make it useful when you want to improve one part of your working practice at a time.",
    "keyIdeas": [
      "Repeated knowledge makes maintenance harder: keep a changing rule in one place.",
      "Adaptable code leaves room for requirements to change without unnecessary assumptions.",
      "Learning, responsibility and testing are ongoing parts of programming, alongside implementation."
    ],
    "prompt": "Find a rule repeated in two places. Identify its owner and what a change would affect. Would sharing it clarify the code or connect unrelated features?",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:32.789358+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.572848+00:00"
    },
    "category": "apps",
    "source": "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/",
    "catalogueId": "apps-2",
    "displayTitle": "The Pragmatic Programmer",
    "byline": "Thomas & Hunt",
    "subtitle": "20th Anniversary Edition"
  },
  {
    "id": "apps-3",
    "kind": "Book",
    "title": "Resilient Web Design",
    "author": "Jeremy Keith",
    "authorShort": "Jeremy Keith",
    "publisher": "Jeremy Keith",
    "intro": "Keith looks at what makes the web resilient through its history, materials and design choices. Chapter 6 turns that perspective into a practical way to build something useful before adding richer behaviour.",
    "keyIdeas": [
      "Begin with the visitor’s goal, such as reading, rather than a gesture like swiping.",
      "Make the essential task work before depending on additional browser capabilities.",
      "Add enhancements in layers so the service remains useful across devices and conditions."
    ],
    "prompt": "Choose one task on your site. Describe a useful version without JavaScript, then add an enhancement. What should still work if that enhancement fails?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Chapter 6: Steps",
      "url": "https://resilientwebdesign.com/chapter6/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:32.789358+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.573849+00:00"
    },
    "category": "apps",
    "source": "https://resilientwebdesign.com/",
    "catalogueId": "apps-3",
    "displayTitle": "Resilient Web Design",
    "byline": "Jeremy Keith",
    "subtitle": ""
  },
  {
    "id": "apps-4",
    "kind": "Article",
    "title": "Common techniques to build offline applications",
    "author": "Jake Archibald",
    "authorShort": "Jake Archibald",
    "publisher": "web.dev / Google",
    "intro": "An offline experience needs decisions about what to keep, what to refresh and what to do when the network is unavailable. Archibald’s worked patterns make those choices visible instead of treating caching as a single switch.",
    "keyIdeas": [
      "Handling requests and deciding when to cache content are separate concerns.",
      "Different resources suit different strategies, such as cache-first or network-first.",
      "Caching during installation, during use or by explicit choice has different costs."
    ],
    "prompt": "Classify three resources in an app: keep offline, refresh when possible or never cache. Explain the trade-off a visitor would notice for each.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://web.dev/articles/offline-cookbook",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:32.790919+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.573849+00:00"
    },
    "category": "apps",
    "source": "https://web.dev/articles/offline-cookbook",
    "catalogueId": "apps-4",
    "displayTitle": "Building offline applications",
    "byline": "Jake Archibald",
    "subtitle": ""
  },
  {
    "id": "apps-5",
    "kind": "Book",
    "title": "A Philosophy of Software Design (2nd edition)",
    "author": "John Ousterhout",
    "authorShort": "John Ousterhout",
    "publisher": "Yaknyam Press",
    "intro": "Ousterhout explores what deserves attention in software design and how complexity grows. Use these second-edition notes to compare design advice and examine which rules actually help you understand your own code.",
    "keyIdeas": [
      "Separating essential concerns from incidental detail is an important design decision.",
      "General-purpose modules can hide useful work behind their interfaces.",
      "Examine the reasoning behind advice about method length and comments, rather than applying slogans."
    ],
    "prompt": "Pick a module with a complicated interface. Sketch a simpler interface and list the details it would hide. Does it reduce complexity or just relocate it?",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free extracts",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Author’s second-edition notes",
      "url": "https://web.stanford.edu/~ouster/cgi-bin/book.php",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:32.790919+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.574846+00:00"
    },
    "category": "apps",
    "source": "https://web.stanford.edu/~ouster/cgi-bin/book.php",
    "catalogueId": "apps-5",
    "displayTitle": "A Philosophy of Software Design",
    "byline": "John Ousterhout",
    "subtitle": "(2nd edition)"
  },
  {
    "id": "quality-1",
    "kind": "Book",
    "title": "Explore It!: Reduce Risk and Increase Confidence with Exploratory Testing",
    "author": "Elisabeth Hendrickson",
    "authorShort": "Elisabeth Hendrickson",
    "publisher": "The Pragmatic Bookshelf",
    "intro": "A test plan cannot anticipate every surprise. Hendrickson treats exploratory testing as focused investigation: use each experiment to choose the next, and follow the questions that a fixed checklist leaves unanswered.",
    "keyIdeas": [
      "A testing charter gives purpose while leaving room to follow unexpected evidence.",
      "Changing sequences, data or timing can reveal behaviour a happy-path check misses.",
      "Separate what the product actually did from what you expected it to do."
    ],
    "prompt": "Explore a sign-up form for five minutes without submitting personal information. Change field order and correct an error. Record one observation, one question and your next experiment.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://pragprog.com/titles/ehxta/explore-it/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:33.728738+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:44.575351+00:00"
    },
    "category": "quality",
    "source": "https://pragprog.com/titles/ehxta/explore-it/",
    "catalogueId": "quality-1",
    "displayTitle": "Explore It!",
    "byline": "Elisabeth Hendrickson",
    "subtitle": "Reduce Risk and Increase Confidence with Exploratory Testing"
  },
  {
    "id": "quality-2",
    "kind": "Book",
    "title": "Agile Testing: A Practical Guide for Testers and Agile Teams",
    "author": "Lisa Crispin and Janet Gregory",
    "authorShort": "Lisa Crispin and Janet Gregory",
    "publisher": "Addison-Wesley Professional",
    "intro": "Crispin and Gregory place testing inside the work of an agile team rather than at the end of a handover. The book is a useful conversation starter about who needs what evidence before a story is finished.",
    "keyIdeas": [
      "Testing is a whole-team concern, beyond assigning every quality question to a tester.",
      "Testing quadrants help distinguish guiding development from evaluating the result.",
      "Short iterations need deliberate testing and automation choices, not a compressed testing phase."
    ],
    "prompt": "Choose a small feature. List the evidence its team needs before release. Who can contribute each kind, and which questions remain unanswered?",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://www.informit.com/store/agile-testing-a-practical-guide-for-testers-and-agile-9780321770394",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:33.892982+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:45.547449+00:00"
    },
    "category": "quality",
    "source": "https://www.informit.com/store/agile-testing-a-practical-guide-for-testers-and-agile-9780321770394",
    "catalogueId": "quality-2",
    "displayTitle": "Agile Testing",
    "byline": "Crispin & Gregory",
    "subtitle": "A Practical Guide for Testers and Agile Teams"
  },
  {
    "id": "quality-3",
    "kind": "Article",
    "title": "The Practical Test Pyramid",
    "author": "Ham Vocke",
    "authorShort": "Ham Vocke",
    "publisher": "martinfowler.com",
    "intro": "Vocke turns the test-pyramid metaphor into a worked example spanning several kinds of tests. It is valuable for comparing feedback speed, scope and confidence, rather than chasing a particular shape for its own sake.",
    "keyIdeas": [
      "Small and broad tests answer different questions; balance their scope and cost.",
      "Integration and contract checks investigate boundaries without running the entire system.",
      "Acceptance and exploration ask whether features serve users, beyond test-layer labels."
    ],
    "prompt": "Map a feature’s checks by scope and feedback speed. Find one question requiring a broad test and one that a smaller check could answer.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://martinfowler.com/articles/practical-test-pyramid.html",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:34.105993+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:45.739974+00:00"
    },
    "category": "quality",
    "source": "https://martinfowler.com/articles/practical-test-pyramid.html",
    "catalogueId": "quality-3",
    "displayTitle": "The Practical Test Pyramid",
    "byline": "Ham Vocke",
    "subtitle": ""
  },
  {
    "id": "quality-4",
    "kind": "Article",
    "title": "The Testing Trophy and Testing Classifications",
    "author": "Kent C. Dodds",
    "authorShort": "Kent C. Dodds",
    "publisher": "kentcdodds.com",
    "intro": "Dodds explains where the Testing Trophy came from and what he meant by its categories. Reading it beside the test pyramid is a useful reminder that testing advice has a context and terms do not always mean the same thing.",
    "keyIdeas": [
      "The trophy’s categories grew out of frontend application work; keep that context in mind.",
      "Testing cooperating parts can reveal behaviour that isolated checks cannot establish.",
      "Seek valuable confidence for the effort invested, rather than universal test-type percentages."
    ],
    "prompt": "Choose an isolated frontend test and an integration test. What confidence does each provide? Identify a visitor-visible failure that neither currently catches.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:34.379185+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:45.759185+00:00"
    },
    "category": "quality",
    "source": "https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications",
    "catalogueId": "quality-4",
    "displayTitle": "Testing Trophy & Classifications",
    "byline": "Kent C. Dodds",
    "subtitle": ""
  },
  {
    "id": "quality-5",
    "kind": "Guide",
    "title": "Best Practices",
    "author": "Playwright contributors",
    "authorShort": "Playwright contributors",
    "publisher": "Playwright / Microsoft",
    "intro": "This guide connects reliable browser tests with what a visitor can observe and do. It is especially useful when a test passes even though the interface still feels broken, or when a harmless markup change breaks a test.",
    "keyIdeas": [
      "Check visible behaviour instead of private function names or incidental implementation details.",
      "Isolate tests so one test’s state does not silently determine another’s outcome.",
      "Use resilient locators and waiting assertions rather than guessed response times."
    ],
    "prompt": "Rewrite a browser check around a visible task. Use a meaningful locator and a waiting assertion. Explain what a passing result actually proves.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://playwright.dev/docs/best-practices",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:34.619270+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.112880+00:00"
    },
    "category": "quality",
    "source": "https://playwright.dev/docs/best-practices",
    "catalogueId": "quality-5",
    "displayTitle": "Best Practices",
    "byline": "Playwright contributors",
    "subtitle": ""
  },
  {
    "id": "inclusive-book",
    "catalogueId": "accessibility-1",
    "kind": "Articles",
    "title": "Inclusive Components",
    "author": "Heydon Pickering",
    "authorShort": "Heydon Pickering",
    "publisher": "Heydon Pickering (web); Smashing Media (book)",
    "intro": "Pickering examines familiar interface components in detail, including the behaviour people need beyond a visual design. The menu article is a good starting point because a small-looking control raises questions about meaning, focus and keyboard use.",
    "keyIdeas": [
      "Ordinary navigation links do not automatically need application-style menu behaviour.",
      "Choose semantics for what a control does, not merely how it looks.",
      "Opening, navigating and leaving a menu need coherent keyboard and focus behaviour."
    ],
    "prompt": "Inspect a site’s navigation with only a keyboard. Can you open, traverse and leave it? Compare the control’s announced role with what it actually does.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free articles · print book available",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Menus & Menu Buttons",
      "url": "https://inclusive-components.design/menus-menu-buttons/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:34.645963+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.179118+00:00"
    },
    "category": "accessibility",
    "source": "https://inclusive-components.design/",
    "displayTitle": "Inclusive Components",
    "byline": "Heydon Pickering",
    "subtitle": ""
  },
  {
    "id": "accessibility-2",
    "kind": "Book",
    "title": "Accessibility For Everyone",
    "author": "Laura Kalbag",
    "authorShort": "Laura Kalbag",
    "publisher": "A Book Apart (original); author-hosted web edition",
    "intro": "Kalbag offers an introduction for the different people who make websites, including designers, writers and developers. It is a useful route into accessibility as everyday product work, rather than a specialist task someone else will handle later.",
    "keyIdeas": [
      "Disability and impairment affect how people encounter an interface; include them in design decisions.",
      "Clear writing, organised information and meaningful HTML contribute to usability.",
      "Plan, evaluate and test alongside design and implementation, rather than waiting until release."
    ],
    "prompt": "Choose one page. Improve a heading, a link label and a paragraph. Test the reading order by keyboard and explain who each change helps.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Free online book",
      "url": "https://accessibilityforeveryone.site/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:32:54.533840+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:32:54.533840+00:00"
    },
    "category": "accessibility",
    "source": "https://accessibilityforeveryone.site/",
    "catalogueId": "accessibility-2",
    "displayTitle": "Accessibility For Everyone",
    "byline": "Laura Kalbag",
    "subtitle": ""
  },
  {
    "id": "targets",
    "catalogueId": "accessibility-3",
    "kind": "Article",
    "title": "Understanding Success Criterion 2.5.8: Target Size (Minimum)",
    "author": "W3C Accessibility Guidelines Working Group (AG WG)",
    "authorShort": "W3C Accessibility Guidelines Working Group",
    "publisher": "W3C Web Accessibility Initiative",
    "intro": "A visible icon and its clickable area are not necessarily the same size. This illustrated explainer makes target size and spacing concrete, helping you understand why a control that looks neat can still be difficult to hit.",
    "keyIdeas": [
      "Target size concerns the clickable area, not just the icon inside it.",
      "Nearby actions affect how easily someone can select an intended small target.",
      "Exceptions and geometry matter; one measurement is not a complete accessibility review."
    ],
    "prompt": "Measure a small control’s clickable area and nearby spacing. Compare both with the explainer, including exceptions. Propose an improvement without changing the icon.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:34.944015+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.692940+00:00"
    },
    "category": "accessibility",
    "source": "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    "displayTitle": "Target Size (Minimum)",
    "byline": "W3C",
    "subtitle": ""
  },
  {
    "id": "accessibility-4",
    "kind": "Guide",
    "title": "Planning and Managing Web Accessibility",
    "author": "W3C Education and Outreach Working Group; editors Kevin White, Shadi Abou-Zahra and Shawn Lawton Henry",
    "authorShort": "Kevin White, Shadi Abou-Zahra & Shawn Lawton Henry (editors)",
    "publisher": "W3C Web Accessibility Initiative",
    "intro": "Accessibility work lasts longer than an audit or a launch. This free guide gives a practical structure for building understanding, assigning work and steadily improving an existing service over time.",
    "keyIdeas": [
      "Understand the current situation and set meaningful accessibility objectives.",
      "Plan responsibilities, resources and monitoring so good intentions become achievable work.",
      "Keep evaluating feedback, content and technology during implementation and after delivery."
    ],
    "prompt": "Write one accessibility goal, an owner and a review date for a small site. Choose a task to evaluate and explain how feedback could change the plan.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.w3.org/WAI/planning-and-managing/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:35.014412+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.734035+00:00"
    },
    "category": "accessibility",
    "source": "https://www.w3.org/WAI/planning-and-managing/",
    "catalogueId": "accessibility-4",
    "displayTitle": "Planning Web Accessibility",
    "byline": "W3C WAI",
    "subtitle": ""
  },
  {
    "id": "accessibility-5",
    "kind": "Tutorial",
    "title": "Page Structure Tutorial",
    "author": "W3C Education and Outreach Working Group; editors Eric Eggert and Shadi Abou-Zahra; update editor Brian Elton",
    "authorShort": "Eric Eggert & Shadi Abou-Zahra; updated by Brian Elton",
    "publisher": "W3C Web Accessibility Initiative",
    "intro": "A page’s structure is an interface for people who navigate by headings, landmarks or a keyboard. This tutorial shows how relationships in the content can remain understandable beyond the visual layout.",
    "keyIdeas": [
      "Descriptive headings make the organisation of a page easier to discover.",
      "Landmarks help people move to meaningful areas such as navigation and main content.",
      "Bypass mechanisms and sensible content order reduce repeated effort between pages."
    ],
    "prompt": "Outline a page with headings and landmarks before drawing it. From the outline alone, can you find the main task and each section?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.w3.org/WAI/tutorials/page-structure/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:35.059510+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.780962+00:00"
    },
    "category": "accessibility",
    "source": "https://www.w3.org/WAI/tutorials/page-structure/",
    "catalogueId": "accessibility-5",
    "displayTitle": "Page Structure Tutorial",
    "byline": "W3C WAI",
    "subtitle": ""
  },
  {
    "id": "product-1",
    "kind": "Book",
    "title": "The Design of Everyday Things (Revised and Expanded Edition)",
    "author": "Don Norman",
    "authorShort": "Don Norman",
    "publisher": "Basic Books",
    "intro": "An awkward door or confusing switch can reveal a design problem, rather than a failure by its user. Norman’s book offers a way to examine how a product guides action and explains what happened afterwards.",
    "keyIdeas": [
      "Make important controls and available actions discoverable rather than ambiguous.",
      "Clear relationships between controls and effects reduce what people must memorise.",
      "Feedback and useful constraints help people choose actions and recognise results."
    ],
    "prompt": "Choose a confusing everyday control. Sketch its action and result, then improve one clue or feedback signal. Explain what a first-time user should understand.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://www.hachettebookgroup.com/titles/don-norman/the-design-of-everyday-things/9780465050659/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:35.122505+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:46.836013+00:00"
    },
    "category": "product",
    "source": "https://www.hachettebookgroup.com/titles/don-norman/the-design-of-everyday-things/9780465050659/",
    "catalogueId": "product-1",
    "displayTitle": "The Design of Everyday Things",
    "byline": "Don Norman",
    "subtitle": "(Revised and Expanded Edition)"
  },
  {
    "id": "product-2",
    "kind": "Book",
    "title": "Don’t Make Me Think, Revisited: A Common Sense Approach to Web Usability",
    "author": "Steve Krug",
    "authorShort": "Steve Krug",
    "publisher": "New Riders",
    "intro": "Krug’s guide makes web usability approachable through practical examples and plain language. It is a useful choice when navigation seems obvious to the team but a first-time visitor still has to work out what to do.",
    "keyIdeas": [
      "Help visitors understand navigation and information with little unnecessary interpretation.",
      "Remove needless words while retaining the information people need.",
      "Mobile usability takes deliberate design, beyond shrinking a desktop composition."
    ],
    "prompt": "Ask someone to find one thing on a page without help. Record where they hesitate. Remove one unnecessary decision or sentence, then try again.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://www.informit.com/store/dont-make-me-think-revisited-a-common-sense-approach-9780321965516",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:35.744171+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:47.038924+00:00"
    },
    "category": "product",
    "source": "https://www.informit.com/store/dont-make-me-think-revisited-a-common-sense-approach-9780321965516",
    "catalogueId": "product-2",
    "displayTitle": "Don’t Make Me Think, Revisited",
    "byline": "Steve Krug",
    "subtitle": "A Common Sense Approach to Web Usability"
  },
  {
    "id": "product-3",
    "kind": "Article",
    "title": "10 Usability Heuristics for User Interface Design",
    "author": "Jakob Nielsen",
    "authorShort": "Jakob Nielsen",
    "publisher": "Nielsen Norman Group",
    "intro": "Nielsen’s ten heuristics give you a vocabulary for discussing an interface before every problem has a user-test recording. They work best as prompts to investigate a specific task, rather than as a score that proves a design is good.",
    "keyIdeas": [
      "Give timely feedback about system state and the effects of actions.",
      "Familiar language, consistency and visible choices reduce unnecessary remembering.",
      "Prevent errors, while still providing clear recovery and exits when mistakes happen."
    ],
    "prompt": "Review one task using three heuristics. For each issue, record what happened, which principle helps explain it and a change you could test.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.nngroup.com/articles/ten-usability-heuristics/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:36.180441+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:47.422742+00:00"
    },
    "category": "product",
    "source": "https://www.nngroup.com/articles/ten-usability-heuristics/",
    "catalogueId": "product-3",
    "displayTitle": "10 Usability Heuristics",
    "byline": "Jakob Nielsen",
    "subtitle": "for User Interface Design"
  },
  {
    "id": "product-4",
    "kind": "Guide",
    "title": "Learning about users and their needs",
    "author": "User research community",
    "authorShort": "User research community",
    "publisher": "GOV.UK Service Manual / Government Digital Service",
    "intro": "A feature request often describes a solution before the underlying need is understood. This guide helps you investigate what people are trying to achieve and keep those needs connected to decisions throughout a service’s life.",
    "keyIdeas": [
      "Research goals, behaviour and frustrations, including those of people facing additional barriers.",
      "Describe the desired outcome without prescribing a particular feature.",
      "Validate and revisit needs as the service develops; assumptions are not automatically evidence."
    ],
    "prompt": "Rewrite a feature request as an outcome without naming the proposed feature. List what you know, what you assume and one question for research.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:36.326809+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:47.672473+00:00"
    },
    "category": "product",
    "source": "https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs",
    "catalogueId": "product-4",
    "displayTitle": "Learning about user needs",
    "byline": "GOV.UK",
    "subtitle": ""
  },
  {
    "id": "product-5",
    "kind": "Book",
    "title": "Shape Up: Stop Running in Circles and Ship Work that Matters",
    "author": "Ryan Singer",
    "authorShort": "Ryan Singer",
    "publisher": "Basecamp",
    "intro": "Singer describes how Basecamp shapes work into bounded projects and gives teams room to solve them. The opening chapter is useful when an appealing idea keeps expanding but nobody can explain what a manageable first version would include.",
    "keyIdeas": [
      "Reduce uncertainty before committing, while leaving room for the team’s design decisions.",
      "A fixed time budget asks what valuable scope can fit.",
      "Find risks and rabbit holes early, before the hardest unknown reaches the deadline."
    ],
    "prompt": "Choose an expanding idea. Set a time budget, sketch the essential scope and name one risky unknown. What can you leave out while preserving its purpose?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Introduction and chapter outline",
      "url": "https://basecamp.com/shapeup/0.3-chapter-01",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:36.367040+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:48.123801+00:00"
    },
    "category": "product",
    "source": "https://basecamp.com/shapeup",
    "catalogueId": "product-5",
    "displayTitle": "Shape Up",
    "byline": "Ryan Singer",
    "subtitle": "Stop Running in Circles and Ship Work that Matters"
  },
  {
    "id": "nature-book",
    "catalogueId": "maths-1",
    "kind": "Book",
    "title": "The Nature of Code",
    "author": "Daniel Shiffman",
    "authorShort": "Daniel Shiffman",
    "publisher": "No Starch Press; author-hosted web edition",
    "intro": "Shiffman uses creative coding to explore natural systems, from motion to groups of agents. The introduction makes a useful distinction: a simulation is a model you can investigate, not a claim to reproduce every detail of nature.",
    "keyIdeas": [
      "A small set of rules can produce behaviour worth observing and modifying.",
      "Vectors and forces describe change in a visual system.",
      "Models simplify deliberately; changing a rule tests what the model can explain."
    ],
    "prompt": "Draw a moving dot with one simple rule. Change one parameter and compare the motion. Write what the model explains and what it deliberately leaves out.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Introduction",
      "url": "https://natureofcode.com/introduction/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:36.495677+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:48.151319+00:00"
    },
    "category": "maths",
    "source": "https://natureofcode.com/",
    "displayTitle": "The Nature of Code",
    "byline": "Daniel Shiffman",
    "subtitle": ""
  },
  {
    "id": "maths-2",
    "kind": "Article",
    "title": "Fibonacci Numbers and Nature",
    "author": "Ron Knott",
    "authorShort": "Ron Knott",
    "publisher": "University of Surrey author site",
    "intro": "Knott introduces the Fibonacci sequence through puzzles, family trees and visible patterns in plants. Its illustrations and investigation questions make it a friendlier starting point than a page dominated by formulas.",
    "keyIdeas": [
      "Add the previous two values repeatedly to generate the sequence.",
      "The rabbit puzzle is a model with assumptions, not a realistic population forecast.",
      "Investigate plant patterns through observation instead of expecting every plant to fit one rule."
    ],
    "prompt": "Write ten Fibonacci numbers, then inspect a plant photograph for spirals. Count what you actually see and record uncertainty rather than forcing a match.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://r-knott.surrey.ac.uk/Fibonacci/fibnat.html",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:36.729039+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:48.629309+00:00"
    },
    "category": "maths",
    "source": "https://r-knott.surrey.ac.uk/Fibonacci/fibnat.html",
    "catalogueId": "maths-2",
    "displayTitle": "Fibonacci Numbers and Nature",
    "byline": "Ron Knott",
    "subtitle": ""
  },
  {
    "id": "maths-3",
    "kind": "Book",
    "title": "Nature’s Numbers",
    "author": "Ian Stewart",
    "authorShort": "Ian Stewart",
    "publisher": "Basic Books",
    "intro": "Stewart invites readers to notice mathematical structure in the ordinary natural world. Flowers, snowflakes and animal markings offer different ways into that exploration, making this a broad companion to the more focused Fibonacci reading.",
    "keyIdeas": [
      "Counting, symmetry and repeated shapes describe different aspects of natural patterns.",
      "Visible structure can reveal organisation, as snowflakes reflect crystal geometry.",
      "Mathematics reveals regularities even in apparently irregular clouds and changing weather."
    ],
    "prompt": "Sketch a pattern from a flower, snowflake or animal marking. Describe its symmetry or repetition, then note one detail your mathematical description leaves out.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "UK publisher’s overview",
      "url": "https://www.hachette.co.uk/titles/ian-stewart/natures-numbers/9780753805305/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:37.231610+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:48.665000+00:00"
    },
    "category": "maths",
    "source": "https://www.hachettebookgroup.com/titles/ian-stewart/natures-numbers/9780465072743/",
    "catalogueId": "maths-3",
    "displayTitle": "Nature’s Numbers",
    "byline": "Ian Stewart",
    "subtitle": ""
  },
  {
    "id": "maths-4",
    "kind": "Reference article",
    "title": "Pascal’s Triangle",
    "author": "Eric W. Weisstein, with contributions by Christopher Stover",
    "authorShort": "Eric W. Weisstein; contributions by Christopher Stover",
    "publisher": "Wolfram MathWorld",
    "intro": "A triangle built by addition can hold several different patterns at once. This reference is most useful as a companion to a drawing: make a few rows yourself before exploring its formulas and historical background.",
    "keyIdeas": [
      "Add the two entries above each interior entry; keep ones along the edges.",
      "Rows contain binomial coefficients, connecting the drawing with ways of counting choices.",
      "Diagonal sums and odd entries connect the triangle with Fibonacci numbers and fractal shapes."
    ],
    "prompt": "Build six rows of Pascal’s triangle by addition. Colour odd entries, then add shallow diagonals. Which familiar sequence appears, and what pattern needs more rows?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://mathworld.wolfram.com/PascalsTriangle.html",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:37.308559+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:49.001148+00:00"
    },
    "category": "maths",
    "source": "https://mathworld.wolfram.com/PascalsTriangle.html",
    "catalogueId": "maths-4",
    "displayTitle": "Pascal’s Triangle",
    "byline": "Eric W. Weisstein",
    "subtitle": ""
  },
  {
    "id": "maths-5",
    "kind": "Book",
    "title": "The Algorithmic Beauty of Plants",
    "author": "Przemysław Prusinkiewicz and Aristid Lindenmayer",
    "authorShort": "Przemysław Prusinkiewicz and Aristid Lindenmayer",
    "publisher": "Springer-Verlag; author research-group web edition",
    "intro": "This illustrated book connects plant forms with mathematical models. Chapter 4 is a rewarding place to start if you want to understand how a short rule can draw a sunflower-like seed arrangement.",
    "keyIdeas": [
      "A fixed turning angle links each new point with the overall seed pattern.",
      "Distance grows with the square root of the point index, reflecting available area.",
      "The chapter connects spirals and Fibonacci numbers, distinguishing geometry from physiological explanations."
    ],
    "prompt": "Draw points on a disk with a repeated turn: compare 90°, 120° and the golden angle. Mark gaps and spokes. What changes as you add points?",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online book",
    "sourceLabel": "Read the free book ↗",
    "basis": {
      "label": "Chapter 4: Phyllotaxis (PDF)",
      "url": "https://algorithmicbotany.org/papers/abop/abop-ch4.pdf",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:37.996405+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:49.229313+00:00"
    },
    "category": "maths",
    "source": "https://algorithmicbotany.org/papers/#abop",
    "catalogueId": "maths-5",
    "displayTitle": "The Algorithmic Beauty of Plants",
    "byline": "Prusinkiewicz & Lindenmayer",
    "subtitle": ""
  },
  {
    "id": "sport-1",
    "kind": "Manual",
    "title": "Futsal Coaching Manual",
    "author": "FIFA",
    "authorShort": "FIFA",
    "publisher": "FIFA Training Centre",
    "intro": "FIFA’s manual covers futsal development, coaching sessions and the demands of the game. Its chapter summaries help you choose a concrete coaching question rather than trying to treat one manual as a solution for every player.",
    "keyIdeas": [
      "Consider the player, game and coach together, rather than technique alone.",
      "Game-based practice gives skills realistic context, especially during earlier development.",
      "Connect session and season activities with learning and development, beyond filling time."
    ],
    "prompt": "Plan a small-sided passing activity with one learning goal. Note players’ decisions and a reflection question. Check space, equipment and safety before any real session.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Manual introduction and chapter summaries",
      "url": "https://www.fifatrainingcentre.com/en/environment/resources/futsal/futsal-coaching-manual.php",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:38.404129+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:49.378482+00:00"
    },
    "category": "sport",
    "source": "https://www.fifatrainingcentre.com/en/environment/resources/futsal/futsal-coaching-manual.php",
    "catalogueId": "sport-1",
    "displayTitle": "Futsal Coaching Manual",
    "byline": "FIFA",
    "subtitle": ""
  },
  {
    "id": "sport-2",
    "kind": "Guide",
    "title": "How to use the cards (Playing for Life)",
    "author": "Australian Sports Commission",
    "authorShort": "Australian Sports Commission",
    "publisher": "Australian Sports Commission",
    "intro": "The Australian Sports Commission’s Playing for Life cards put games and participation at the centre of learning. This guide explains how to read and adapt the cards instead of running the same activity unchanged for every group.",
    "keyIdeas": [
      "Activities have learning intentions alongside instructions, equipment and player numbers.",
      "Changing a game can adjust difficulty, participation or the decisions players practise.",
      "Player questions and safety guidance are essential parts of using each card."
    ],
    "prompt": "Adapt a passing game: one easier version, one harder version and one that includes a player left out. Explain which learning goal each preserves.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://www.ausport.gov.au/schools/resource-hub/p4l/how-to-use-the-cards",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:38.564337+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:49.765107+00:00"
    },
    "category": "sport",
    "source": "https://www.ausport.gov.au/schools/resource-hub/p4l/how-to-use-the-cards",
    "catalogueId": "sport-2",
    "displayTitle": "Playing for Life",
    "byline": "Australian Sports Commission",
    "subtitle": ""
  },
  {
    "id": "sport-3",
    "kind": "Book",
    "title": "The Constraints-Led Approach: Principles for Sports Coaching and Practice Design",
    "author": "Ian Renshaw, Keith Davids, Daniel Newcombe and Will Roberts",
    "authorShort": "Ian Renshaw, Keith Davids, Daniel Newcombe and Will Roberts",
    "publisher": "Routledge",
    "intro": "This book connects learning theory with the design of sporting activities. It shows how you can shape practice so that players discover useful solutions within their own sport and learning context.",
    "keyIdeas": [
      "Skill develops through interacting constraints, rather than movement isolated from its situation.",
      "Practice design creates a learning environment, using an explicit design framework.",
      "Adapt the approach to each sporting context rather than copying one universal drill."
    ],
    "prompt": "Change one constraint in a familiar practice activity: space, equipment or a rule. Predict the decisions it encourages, then observe before deciding whether it helped.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://www.routledge.com/link/link/p/book/9781138104075",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:38.598353+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:49.991855+00:00"
    },
    "category": "sport",
    "source": "https://www.routledge.com/link/link/p/book/9781138104075",
    "catalogueId": "sport-3",
    "displayTitle": "The Constraints-Led Approach",
    "byline": "Renshaw, Davids & colleagues",
    "subtitle": "Principles for Sports Coaching and Practice Design"
  },
  {
    "id": "sport-4",
    "kind": "Book",
    "title": "The Inner Game of Tennis (50th Anniversary Edition)",
    "author": "W. Timothy Gallwey",
    "authorShort": "W. Timothy Gallwey",
    "publisher": "Random House",
    "intro": "Gallwey focuses on the mental side of performance: the doubts and distractions that can interrupt an activity you know how to do. This perspective offers a useful contrast with readings about practice design and technique.",
    "keyIdeas": [
      "Self-doubt, nervousness and lapses in attention form part of a player’s inner challenge.",
      "Concentration can be calm rather than cluttered by constant mental interference.",
      "Trust and changing habits contribute to learning alongside the sport’s visible movements."
    ],
    "prompt": "Choose a familiar, safe skill. Notice one movement without judging it, then reflect on attention and distraction. Compare that experience with constant technical self-instruction.",
    "exerciseMinutes": 5,
    "paid": true,
    "access": "Paid book · free overview",
    "sourceLabel": "Book details ↗",
    "basis": {
      "label": "Publisher’s overview",
      "url": "https://www.penguinrandomhouse.com/books/57757/the-inner-game-of-tennis-50th-anniversary-edition-by-w-timothy-gallwey/",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:38.648964+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:50.242657+00:00"
    },
    "category": "sport",
    "source": "https://www.penguinrandomhouse.com/books/57757/the-inner-game-of-tennis-50th-anniversary-edition-by-w-timothy-gallwey/",
    "catalogueId": "sport-4",
    "displayTitle": "The Inner Game of Tennis",
    "byline": "W. Timothy Gallwey",
    "subtitle": "(50th Anniversary Edition)"
  },
  {
    "id": "sport-5",
    "kind": "Article",
    "title": "Rip Currents",
    "author": "Surf Life Saving Australia",
    "authorShort": "Surf Life Saving Australia",
    "publisher": "Beachsafe / Surf Life Saving Australia",
    "intro": "The coast is inviting, but understanding it includes recognising hazards. Surf Life Saving Australia’s illustrated guide explains rip currents and why checking conditions and choosing a patrolled swimming area matter.",
    "keyIdeas": [
      "A gap with fewer breaking waves can signal danger rather than a safe entry.",
      "Rip currents change shape and location; no single visual clue is infallible.",
      "Check hazards, plan before entering, and swim between flags at a patrolled beach."
    ],
    "prompt": "Study the guide’s beach illustrations. Identify possible rip-current signs and note uncertainty. Write a safer plan using current conditions, patrol advice and the flagged area.",
    "exerciseMinutes": 5,
    "paid": false,
    "access": "Free online reading",
    "sourceLabel": "Read online ↗",
    "basis": {
      "label": "Original reading",
      "url": "https://beachsafe.org.au/surf-safety/ripcurrents",
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:25:39.045533+00:00"
    },
    "sourceChecked": {
      "httpStatus": 200,
      "checkedAt": "2026-10-17T01:20:50.552013+00:00"
    },
    "category": "sport",
    "source": "https://beachsafe.org.au/surf-safety/ripcurrents",
    "catalogueId": "sport-5",
    "displayTitle": "Rip Currents",
    "byline": "Surf Life Saving Australia",
    "subtitle": ""
  }
];

export class ReadingShelf {
 constructor(random=Math.random,{books=true}={}) {
  this.books=books;this.random=random;this.last=new Map();this.category='apps';this.current=null;
 }
 eligible() {return readings.filter(r=>this.books||r.kind!=='Book');}
 select(id) {
  const reading=this.eligible().find(r=>r.id===id);
  if(!reading)return null;
  this.category=reading.category;this.last.set(reading.category,reading.id);this.current=reading.id;
  return reading;
 }
 choose(pool) {return this.select(pool[Math.min(pool.length-1,Math.floor(this.random()*pool.length))].id);}
 pick(category=this.category) {
  this.category=readingCategories.some(([id])=>id===category)?category:'apps';
  const eligible=this.eligible().filter(r=>r.category===this.category);
  const fresh=eligible.filter(r=>r.id!==this.last.get(this.category));
  return this.choose(fresh.length?fresh:eligible);
 }
 suggest() {
  return this.choose(this.eligible().filter(r=>r.id!==this.current));
 }
 next(id=this.current) {
  const reading=readings.find(r=>r.id===id);if(!reading)return this.pick();
  const chapter=this.eligible().filter(r=>r.category===reading.category);
  return this.select(chapter[(chapter.findIndex(r=>r.id===id)+1)%chapter.length].id);
 }
}
