export const APP_GUIDE = `Parallax — World. Explained. is an interactive science lab. Its learning loop is ask, understand, predict, experiment, explain what changed.
Input: enter a focused scientific question, a concept name, or a formula in plain text. Example: Why do waves cancel each other out? Kinetic energy. E = mc². Suspicious formula typos require user confirmation; incomplete or unsuitable inputs show guidance. Do not claim every possible topic is supported.
Users start by typing a question, a concept, or an equation and choosing Create experiment. There is no catalogue browser. Familiar equations open the matching interactive model; other suitable questions use the lesson-generation service. The help chat uses Gemma, separately from lesson generation.
Quick intuition focuses on the main idea; Explain & explore offers hands-on investigation; Build from basics gives a guided explanation. Users can switch modes and keep their parameter values. Controls change model parameters; readouts and visualizations show consequences. Constants are fixed. Diagrams can be schematic; check the lesson's assumptions. Only explain actual controls and results in the supplied context; do not invent hidden controls or measurements.
Users can pin a reference, compare results, make predictions, reset values, save experiments, and reopen them from Saved experiments without another generation request. Saved experiments/settings use localStorage in this browser, not an account or cloud sync. Up to 50 saved experiments are kept; storage may be full or unavailable. Another device/browser does not automatically have them.
Settings offers visual effects and motion preferences. Reduced motion pauses experiments initially and limits decorative animation. Visual effects controls the dithered background, scanlines and glow. The observer robot follows the pointer and is also the guide launcher; hovering introduces help, clicking/tapping opens chat. It never automatically creates a lesson or changes values.
Errors: keep the question, review any visible error, retry when appropriate, try a clearer question, or try a familiar formula such as P=W/t. Missing credentials, quota, unavailable models or network failures can block custom generation. You cannot inspect a user's provider account, secret key, deployment logs, or live billing. Never claim to fix server configuration. Explain only what the current visible error establishes.
The help chat remains available while navigating. Closing it preserves this tab's conversation. Clear chat removes it. Known quick-help answers come from this guide and do not call a model; other questions are sent with recent chat and limited current-screen context to Gemma. The robot's guide is about this web app and its current lessons, not unrelated general chat. The interface calls it Ask Parallax.`;

export function localGuideAnswer(question, context) {
  const q = question.toLowerCase().replace(/[’']/g, "'");
  const example = { type: 'fill-question', question: 'Why do waves cancel each other out?' };
  let answer,
    actions = [];
  if (
    /what (?:can|should|do|am).*?(?:enter|paste|type)|expected.*(?:paste|enter)|how (?:do i|to) (?:start|use)|how does (?:parallax|this app) work|what is parallax|start a new experiment/.test(
      q,
    )
  ) {
    answer =
      'Start with one idea: a scientific question, concept name, or formula. For example, “Why do waves cancel each other out?” Choose a learning mode, then Create experiment. You’ll get a visual explanation with controls and results to explore.';
    actions = [example];
  } else if (/good example|rephrase|example question/.test(q)) {
    answer =
      'Try “Why do waves cancel each other out?” It opens an experiment where changing the phase lets you see waves reinforce or cancel. The button below fills the input for you to review; it won’t submit it.';
    actions = [example];
  } else if (/learning mode|which mode|quick intuition|build from basics|explain.*explore/.test(q)) {
    answer =
      'Choose Quick intuition for the main idea, Explain & explore to investigate with controls, or Build from basics for a guided explanation. You can switch modes inside a lesson while keeping your current values.';
    actions = [{ type: 'show-modes' }];
  } else if (/where.*sav|another (?:device|browser)|cloud sync|saved experiment|save.*experiment/.test(q)) {
    answer = `Use Save experiment, then reopen it from Saved experiments. Your saved experiments live in this browser on this device; they don’t sync to another browser or device. You currently have ${context.savedCount} saved. Reopening a saved experiment doesn’t generate it again.`;
    actions = [{ type: 'open-saved' }];
  } else if (/without ai|without.*key|browse.*library|preloaded|formula (?:library|collection)/.test(q)) {
    answer =
      'Type a familiar equation, such as P=W/t, into the input and choose Create experiment. Some equations open directly in your browser; other questions need the configured AI service.';
    actions = [{ type: 'fill-question', question: 'P=W/t' }];
  } else if (/reduced motion|visual effects|turn.*effects.*off/.test(q)) {
    answer =
      'Open Settings to choose your motion preference and turn visual effects on or off. Reduced motion starts experiments paused and limits decorative animation. You can still change values and use the available step controls.';
    actions = [{ type: 'open-settings' }];
  } else if (/what should i try first|what does this control change/.test(q) && context.controls.length) {
    const c = context.controls[0];
    answer = `Start with ${c.label}. It is currently ${c.value}. ${c.hint || 'Change it a little and compare the scene and readouts.'} Pin your starting values if you want a reference, then watch what changes. The highlight button points to the actual control.`;
    actions = [{ type: 'highlight-control', controlId: c.id }];
  } else if (/why couldn.?t.*open|why.*(?:error|fail)|couldn.?t.*open/.test(q) && context.error) {
    answer = `The screen reports: “${context.error}” Keep your question and follow that guidance. You can retry, rephrase the question, or try a familiar equation such as P=W/t. I can’t inspect your provider account or server settings from here.`;
    actions = [example];
  }
  return answer ? { answer, actions, source: 'guide' } : null;
}
