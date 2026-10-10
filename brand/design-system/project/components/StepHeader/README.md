StepHeader tells people where they are in a flow: a Back button, "Step 2 of 4", a progress bar, and the step's title.

Every multi-step flow starts each screen with it (adding a medicine is four steps: photo, check each line, set times, done). The consumer provides `step`, `total` (never more than 5), `title` as a short instruction ("Check each line with the paper"), and `onBack` (leave it out on step 1). The title is the screen's only `title`-style text.
