const table = (label, head, rows) =>
  `<div class="hb-scroll" tabindex="0" role="region" aria-label="${label}"><table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
const link = (text, href) => `<a href="${href}">${text}</a>`;
const NEW = (text = "New") => `<span class="hb-new">${text}</span>`;

const AIR = "https://nuphy.com/products/nuphy-air75-he-magnetic-switch-gaming-keyboard";
const NODE = "https://nuphy.com/products/nuphy-node-series-low-profile-page";
const KICK = "https://nuphy.com/products/nuphy-kick75";
const HALO = "https://nuphy.com/products/nuphy-halo-v2-io";

export const nav = `<nav class="hm-nav" aria-label="On this page"><a href="#model">Model</a><a href="#why">Why these six</a><a href="#parts">Parts</a><a href="#fit">Why NuPhy</a><a href="#path">Build path</a><a href="#software">Software</a><a href="#risks">Risks</a></nav>`;

export const eyebrow = `<p class="hm-eyebrow">Concept and build brief, prepared for NuPhy &middot; 19 November 2026</p>`;

export const brief = `<div class="hb">
<section id="parts"><h2>Parts list</h2>
<p>Most of Helm is ordinary keyboard hardware. Four parts move under motor power and are new work: the consent key, the rising agent keys, the microphone stalk and the letter drawer. Sizes are starting points, not tolerances.</p>
${table(
  "Parts list",
  ["Part", "Size in the model (mm)", "One way to build it", "Status"],
  [
    ["Deck", "300 &times; 108 &times; 18, on 3 mm feet", "Aluminium top case, plastic bottom, as on current boards", "Standard"],
    ["Talk bar", "132 &times; 24 cap, 2.2 travel", "Stabilised wide key on a normal switch", "Standard"],
    ["Agent keys (5)", "26 &times; 22 caps, 4 gap, 6 rise", "Normal switch and LED per key; the rise needs a small cam or lead-screw lifter under each key", NEW("New: the rise")],
    ["Lamp and progress bar", "Lamp 2.5 dia, bar 17 &times; 4 per key", "One LED and a small light bar or segment display in each cap", "Adapted"],
    ["Ribbon", "168 &times; 10.6 window, about 40 characters", "Bar OLED or e-paper strip behind a window in a 23 mm riser", "Adapted"],
    ["Consent key", "21 dia cap, 4 travel, stands 33 above the deck", "Cap on a coil spring (0.5 N/mm). A gearmotor turns a nut up a threaded post to add 1 to 12 mm of preload", NEW()],
    ["Force gauge", "17 dia dial, 0 to 8 N", "Small stepper-driven needle, or drop the dial and show the force on the ribbon", "Adapted"],
    ["Undo wheel", "34 dia, 12 notches a turn", "Detented rotary encoder under a knurled aluminium wheel", "Standard"],
    ["Leash lever", "4 stops, 11 apart", "Four-position detented slide switch with a lever knob", "Standard"],
    ["Halt button", "27 dia mushroom head, 3 travel", "Latching push-button: push to latch, push again to release", "Standard"],
    ["Microphone stalk", "9.2 dia, rises 14.2", "MEMS microphone in a stalk on a stepper and lead screw, as in pop-up phone cameras", NEW()],
    ["Letter drawer", "110 wide, 46 travel, 26 keys at 9.6 pitch", "Sliding tray on rails with its own key board and a flex cable; an open/closed sensor", NEW()],
    ["Ear cradle", "38 &times; 19 &times; 3.4, two wells", "Charging dock with spring contacts. Could be left out of a first build", "Optional"],
    ["Power and data", "One USB-C port, power slide switch", "As on current boards", "Standard"],
  ],
)}
<p>The consent key in full: spring rate 0.5 N/mm, preload force 0.5 N at stakes 0 and 6 N at stakes 1, and 4 mm of travel adding up to 2 N. The finger meets between 0.5 N and 8 N.</p>
</section>

<section id="fit"><h2>Why NuPhy</h2>
<p>NuPhy already ships most of what Helm needs, spread across four current boards. These facts are from NuPhy&rsquo;s product pages as read on 19 November 2026.</p>
${table(
  "What NuPhy already makes",
  ["NuPhy product", "What it has", "Where Helm uses it"],
  [
    [link("Air75 HE", AIR), "Gateron low-profile magnetic switches, actuation adjustable from 0.1 to 3.3 mm, configured in NuPhyIO", "Consent key: a magnetic switch reads how far the key is pressed, so a first version can demand a deeper, longer press for higher stakes with no motor at all"],
    [link("Node series", NODE), "A touch zone with dot-matrix LEDs that takes slides and taps; tri-mode wireless; hot-swap", "Leash and undo could start life on the touch zone; the dot-matrix LEDs are a ready-made progress display"],
    [link("Kick75", KICK), "A control knob, open-source QMK and VIA firmware, an open 3D-print interface, 2500 mAh battery", "Undo wheel; open firmware for the new host messages; printed parts for the first enclosure"],
    [link("Halo IO series", HALO), "Aluminium top case, 4000 mAh battery, 2.4 GHz, Bluetooth and USB-C", "Deck construction, power and radio"],
  ],
)}
</section>

<section id="path"><h2>Build path</h2>
<p>Six stages. NuPhy can stop after any of them, and the first needs no new hardware. No stage has a duration here, because those are NuPhy&rsquo;s to estimate.</p>
<ol class="hb-steps">
<li><strong>Prove the interaction on a board you already sell.</strong> Take a Kick75 with QMK firmware. Remap six keys to talk, yes, take back, leash, halt and letters. Write a small desktop app that listens while Space is held, hands the sentence to an assistant, and waits for Enter before anything risky runs.<span class="hb-done">Done when five people can run a morning&rsquo;s tasks by voice and say whether the six keys feel right.</span></li>
<li><strong>Add stakes without a motor.</strong> Move the yes key to a magnetic switch. Let the app send a stakes value from 0 to 1, and have the firmware require a deeper and longer press as it rises, up to the full 3.3 mm held for about a second.<span class="hb-done">Done when testers can tell a low-stakes request from a high-stakes one by feel alone.</span></li>
<li><strong>Build the fixed parts as a bench prototype.</strong> A printed enclosure at the model&rsquo;s 300 &times; 108 mm footprint with the talk bar, five agent keys with lamps, the ribbon display, the undo wheel, the leash lever and the latching halt button. The microphone is fixed, but wired so that its supply line is cut unless the bar is down.<span class="hb-done">Done when the whole tour in the model can be played on real hardware, minus the four moving parts.</span></li>
<li><strong>Develop the four moving parts, each on its own test rig.</strong>
<ul>
<li>Consent key: motor-wound spring preload. Measure force accuracy, noise, the time to wind from 0.5 N to 6 N, and cycle life.</li>
<li>Agent keys: a lifter that raises a cap 6 mm and still lets it be pressed.</li>
<li>Microphone stalk: a 14 mm rise that survives being pushed down by hand.</li>
<li>Letter drawer: rails, flex cable and a key technology thin enough for the tray.</li>
</ul>
<span class="hb-done">Done when each part has a measured cost, noise level and failure rate.</span></li>
<li><strong>Decide what earns its place, then build an integrated sample.</strong> Test the moving parts against their fixed stand-ins from stages 2 and 3 with real users. Keep only the ones that measurably help. Then make one custom board and aluminium case with what is left.<span class="hb-done">Done when there is one sample that works end to end and a list of what was cut and why.</span></li>
<li><strong>Design for manufacture.</strong> Tooling, radio and battery certification, drop and dust tests for the moving parts, price.<span class="hb-done">Done when NuPhy can quote a unit cost and a launch date.</span></li>
</ol>
</section>

<section id="software"><h2>Firmware and host software</h2>
<p>Helm is a normal USB keyboard and microphone plus one extra channel of small messages between the board and a companion app. The app talks to whichever assistant the owner uses. The board never needs to know which.</p>
${table(
  "Messages between board and app",
  ["Direction", "Message", "Carries"],
  [
    ["Board to app", "Talk", "Bar down, bar up"],
    ["Board to app", "Yes", "Consent key pressed through, with how far and how long"],
    ["Board to app", "Take back", "Undo wheel moved, plus or minus one notch"],
    ["Board to app", "Leash", "Which of the four stops, 0 to 3"],
    ["Board to app", "Halt", "Latched or released"],
    ["Board to app", "Agent picked", "Which agent key was tapped, 1 to 5"],
    ["Board to app", "Letters", "Drawer open or shut; the 26 keys arrive as ordinary key presses"],
    ["App to board", "Ribbon", "Up to 40 characters of text"],
    ["App to board", "Agent state", "Per key: idle, working, asking or done, and progress 0 to 100"],
    ["App to board", "Stakes", "0 to 1 for the request now waiting; sets the consent force"],
  ],
)}
<p>Three rules the firmware should hold to:</p>
<ul>
<li><strong>Only the key can say yes.</strong> The app can raise the stakes but can never send a Yes itself.</li>
<li><strong>The microphone is off in hardware.</strong> Its supply is switched by the talk bar, not by software.</li>
<li><strong>Halt wins.</strong> While the button is latched the board sends no Yes, whatever else is pressed.</li>
</ul>
<p>In the model the app scores stakes from the verb of the instruction: 0.05 for find, 0.2 for draft, 0.45 for send, 0.62 for pay or book, 0.95 for delete. The leash stops ask at 0, 0.2, 0.5 and 0.8. A real product would need a better scorer than a verb list. The scale is the part worth keeping.</p>
</section>

<section id="risks"><h2>Open questions and risks</h2>
<p>The model was drawn to explain an idea, and several of its sizes would not survive engineering as they stand.</p>
<ul>
<li><strong>Does force do more than delay?</strong> Nobody has tested whether a stiffer key reduces wrong approvals better than a longer hold. Stages 2 and 5 exist to answer this.</li>
<li><strong>The letter keys are too small and the drawer too shallow.</strong> A 9.6 mm pitch is half a normal key, and the tray is 10 mm tall, which no mechanical switch fits. It needs a thin key technology or a deeper deck.</li>
<li><strong>The consent key stands 33 mm proud.</strong> That is easy to see and hard to carry. A lower mechanism, or one that winds a spring sideways under the deck, may be needed.</li>
<li><strong>Motors in a keyboard.</strong> Four moving parts add cost, noise, dust paths and things to break. They may also rule out long battery life.</li>
<li><strong>Who makes the software?</strong> The board is only half a product. It needs a companion app and an agreed message format, from NuPhy, a partner, or an open specification.</li>
<li><strong>People who cannot speak or cannot press 6 N.</strong> The letters cover the first. The second needs a user-set ceiling on the force.</li>
<li><strong>Privacy of speech.</strong> Whether recognition runs on the computer or in a service is the app&rsquo;s choice, but the board should make listening visible either way.</li>
<li><strong>No prior-art or patent search has been done.</strong></li>
</ul>
</section>
</div>`;
