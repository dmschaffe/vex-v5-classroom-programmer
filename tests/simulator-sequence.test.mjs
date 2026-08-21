import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("program timing is isolated from robot animation renders", () => {
  assert.match(
    pageSource,
    /setTimeout\(\(\) => executeStepRef\.current\(\), Math\.max\(MIN_STEP_DELAY_MS, STEP_DELAY_MS \/ speed\)\); return \(\) => clearTimeout\(timer\); }, \[runState, runIndex, speed, activeProgram\]\)/,
  );
});

test("Fast mode removes teaching delay but preserves real timed commands", () => {
  assert.match(pageSource, /const MIN_STEP_DELAY_MS = 12/);
  assert.match(pageSource, /const FAST_CODE_SPEED = 12/);
  assert.match(pageSource, /<option value=\{FAST_CODE_SPEED\}>Fast<\/option>/);
  assert.match(pageSource, /Math\.max\(250, Number\(a\) \* 4\)\)/);
  assert.match(pageSource, /Math\.max\(250, Number\(a\) \* 9\)\)/);
  assert.match(pageSource, /Date\.now\(\) \+ Number\(a\) \* 1000/);
  const timedCommands = pageSource.slice(pageSource.indexOf('if (action === "drive")'), pageSource.indexOf('if (action === "waitsensor")'));
  assert.doesNotMatch(timedCommands, /\/ speed/);
});

test("simulator starts facing right and provides a position reset", () => {
  assert.match(pageSource, /const DEFAULT_ROBOT = \{ x: 16, y: 50, heading: 0 \}/);
  assert.match(pageSource, /function resetRobot\(\).*setRobot\(currentPlayground\.start\)/);
  assert.match(pageSource, />↻ Reset Robot<\/button>/);
});

test("finished programs honor explicit motor stop commands", () => {
  assert.match(pageSource, /endsWithStop\(activeProgram, "left"\).*setLeftDirection\(0\)/);
  assert.match(pageSource, /endsWithStop\(activeProgram, "right"\).*setRightDirection\(0\)/);
  assert.match(pageSource, /pairedDriveStop.*setLeftDirection\(0\)/s);
  assert.match(pageSource, /pairedDriveStop.*setRightDirection\(0\)/s);
  assert.match(pageSource, /Both drive motors stopped/);
});

test("consecutive drive-motor spin commands start together", () => {
  assert.match(pageSource, /const pairedDriveSpin = nextAction === "spin"/);
  assert.match(pageSource, /pairedDriveSpin.*setLeftDirection\(Number\(nextDirection\)\)/s);
  assert.match(pageSource, /pairedDriveSpin.*setRightDirection\(Number\(nextDirection\)\)/s);
  assert.match(pageSource, /Both drive motors started together/);
  assert.match(pageSource, /pairedDriveSpin.*setRunIndex\(currentIndex \+ 2\)/s);
});

test("Python toolbox commands insert at the editor cursor", () => {
  assert.match(pageSource, /pythonEditorRef = useRef<HTMLTextAreaElement/);
  assert.match(pageSource, /editor\.selectionStart, end: editor\.selectionEnd/);
  assert.match(pageSource, /insertPythonSnippet\(python, code, selection\.start, selection\.end\)/);
  assert.match(pageSource, /insertPythonCode\(entry\.python\)/);
  assert.match(pageSource, /setSelectionRange\(inserted\.caret, inserted\.caret\)/);
  assert.match(pageSource, /onSelect=\{\(e\) => rememberPythonSelection\(e\.currentTarget\)\}/);
  const insertionSource = pageSource.slice(pageSource.indexOf("function insertPythonSnippet"), pageSource.indexOf("function changePythonIndent"));
  assert.match(insertionSource, /value: `\$\{before\}\$\{formattedSnippet\}\$\{after\}`/);
  assert.match(insertionSource, /caret: before\.length \+ formattedSnippet\.length/);
  assert.doesNotMatch(insertionSource, /const leading|const trailing/);
});

test("Tab and Shift+Tab edit Python indentation instead of leaving the editor", () => {
  assert.match(pageSource, /function changePythonIndent/);
  assert.match(pageSource, /if \(event\.key !== "Tab"\) return/);
  assert.match(pageSource, /event\.preventDefault\(\)/);
  assert.match(pageSource, /changePythonIndent\(editor\.value, editor\.selectionStart, editor\.selectionEnd, event\.shiftKey\)/);
  assert.match(pageSource, /onKeyDown=\{handlePythonKeyDown\}/);
  assert.match(pageSource, /source\.slice\(0, start\)\}    \$\{source\.slice\(end\)/);
  assert.match(pageSource, /line\.match\(\/\^\(\?: \{1,4\}\|\\t\)\//);
});

test("nested Python instructions require one complete four-space indentation level", () => {
  assert.match(pageSource, /function pythonIndentWidth/);
  assert.match(pageSource, /function pythonIndentErrors/);
  assert.match(pageSource, /messages\.push\(\.\.\.pythonIndentErrors\(lines\), \.\.\.unconditionalLedOffWarnings\(lines\), \.\.\.competingMotorBranchWarnings\(lines\)\)/);
  assert.match(pageSource, /bodyIndent < indent \+ 4/);
  assert.match(pageSource, /Line \$\{bodyIndex \+ 1\} needs to move right/);
  assert.match(pageSource, /inside the purple \$\{trimmed\.split/);
  assert.match(pageSource, /indent % 4 !== 0/);
});

test("Python mode uses a VEXcode-style text workspace", () => {
  assert.match(pageSource, /className="python-filebar"/);
  assert.match(pageSource, /> main\.py</);
  assert.match(pageSource, /className="python-highlight"/);
  assert.match(pageSource, /<PythonSyntax code=\{python\}/);
  assert.match(pageSource, /className="python-command-row"/);
  assert.match(pageSource, /Python commands/);
});

test("parameterized Python commands expose editable options", () => {
  assert.match(pageSource, /function getPythonOptionTemplate/);
  assert.match(pageSource, /Motor velocity options/);
  assert.match(pageSource, /Drive options/);
  assert.match(pageSource, /Brain print options/);
  assert.match(pageSource, /If \/ else options/);
  assert.match(pageSource, /While options/);
  assert.match(pageSource, /className="python-options-panel"/);
  assert.match(pageSource, /Insert at cursor/);
});

test("Python Motion drawer matches the generic VEX motor reference", () => {
  const motionSource = pageSource.slice(pageSource.indexOf("function buildMotionGroups"), pageSource.indexOf("function buildThreeWireGroups"));
  assert.match(motionSource, /heading: "Actions"/);
  assert.match(motionSource, /heading: "Mutators"/);
  assert.match(motionSource, /heading: "Getters"/);
  assert.match(motionSource, /motor\.spin\(FORWARD\)/);
  assert.match(motionSource, /motor\.spin_for\(FORWARD, 90, DEGREES\)/);
  assert.match(motionSource, /motor\.spin_to_position\(90, DEGREES\)/);
  assert.match(motionSource, /motor\.set_velocity\(50, PERCENT\)/);
  assert.match(motionSource, /motor\.set_stopping\(BRAKE\)/);
  assert.match(motionSource, /motor\.set_max_torque\(50, PERCENT\)/);
  assert.match(motionSource, /motor\.is_spinning\(\)/);
  assert.match(motionSource, /motor\.temperature\(PERCENT\)/);
  assert.match(motionSource, /devices\.filter\(\(device\) => device\.type === "Smart Motor"\)/);
  assert.match(pageSource, /entry\.displayPython \?\? entry\.python/);
  assert.match(pageSource, /activeCategory === "Motion" \? motionGroups/);
  assert.match(pageSource, /className="drawer-command-group"/);
  assert.match(pageSource, /getPythonOptionTemplate\(entry, devices\)/);
  assert.match(pageSource, /useState\("Motion"\)/);
  assert.match(pageSource, /setActiveCategory\("Motion"\)/);
});

test("configured 3-Wire devices appear in a dedicated 3-Wire drawer", () => {
  assert.match(pageSource, /"3-Wire": \{ color:/);
  assert.match(pageSource, /function buildThreeWireGroups\(devices: Device\[\], mode: Mode\)/);
  assert.match(pageSource, /buildThreeWireGroups\(devices, mode\)/);
  assert.match(pageSource, /device\.type === "Bumper"/);
  assert.match(pageSource, /device\.type === "Limit Switch"/);
  assert.match(pageSource, /device\.type === "Light Sensor"/);
  assert.match(pageSource, /device\.type === "Line Tracker"/);
  assert.match(pageSource, /device\.type === "Potentiometer"/);
  assert.match(pageSource, /device\.type === "LED"/);
  const threeWireSource = pageSource.slice(pageSource.indexOf('"3-Wire": {'), pageSource.indexOf('Control: {'));
  assert.doesNotMatch(threeWireSource, /while not|waitsensor/);
  assert.doesNotMatch(pageSource.slice(pageSource.indexOf('Looks: {'), pageSource.indexOf('"3-Wire": {')), /led_f\.(?:on|off)/);
});

test("Control uses generic VEX Python structures instead of sensor-specific combinations", () => {
  const controlSource = pageSource.slice(pageSource.indexOf('Control: {'), pageSource.indexOf('Operators: {'));
  assert.match(controlSource, /wait\(1, SECONDS\)/);
  assert.match(controlSource, /for count in range\(4\)/);
  assert.match(controlSource, /if condition/);
  assert.match(controlSource, /ifelse/);
  assert.match(controlSource, /ifelifelse/);
  assert.match(controlSource, /while condition/);
  assert.match(controlSource, /brain\.program_stop\(\)/);
  assert.match(controlSource, /python: "break"/);
  assert.match(controlSource, /python: "pass"/);
  assert.doesNotMatch(controlSource, /bumper_a|limit_switch_b/);
});

test("Python sensor conditionals are preserved and evaluated by the simulator", () => {
  assert.match(pageSource, /match = text\.match\(\/\^if\\s\+\(\.\+\)\\s\*:\\s\*\$\//);
  assert.match(pageSource, /condition\?: string/);
  assert.match(pageSource, /function evaluateSensorCondition/);
  assert.match(pageSource, /evaluateSensorCondition\(block\.condition \?\? "False", sensors, devices\)/);
  assert.match(pageSource, /FALSE — skipping indented code/);
  assert.match(pageSource, /findScopeEnd\(activeProgram, currentIndex\)/);
});

test("drive_for and turn_for stop after their requested simulated movement", () => {
  assert.match(pageSource, /setPendingMotion\("drive"\)/);
  assert.match(pageSource, /setPendingMotion\("turn"\)/);
  assert.match(pageSource, /Drive distance.*completed — motors stopped/);
  assert.match(pageSource, /loopConditions.*else \{ loopMotionCarryRef\.current = null; setLeftDirection\(0\); setRightDirection\(0\)/);
  assert.match(pageSource, /setPendingMotion\(null\)/);
});

test("drivetrain velocity commands set every drive motor to the same speed", () => {
  assert.match(pageSource, /drivetrain\\\.\(set_drive_velocity\|set_turn_velocity\)/);
  assert.match(pageSource, /`velocity:both:\$\{match\[2\]\}`/);
  assert.match(pageSource, /a === "left" \|\| a === "both"\) setLeftVelocity\(Number\(b\)\)/);
  assert.match(pageSource, /a === "right" \|\| a === "both"\) setRightVelocity\(Number\(b\)\)/);
  assert.match(pageSource, /Drivetrain group velocity set to \$\{b\}% on both sides/);
  assert.match(pageSource, /new Set\(\[\.\.\.devices\.map\(\(d\) => d\.name\), "drivetrain"\]\)/);
  assert.match(pageSource, /set_\(\?:drive_\|turn_\)\?velocity/);
});

test("interactive switches can be latched before running an if condition", () => {
  assert.match(pageSource, /className=\{classNames\("sensor-latch", pressed && "active"\)\}/);
  assert.match(pageSource, /Keep pressed for Run/);
  assert.match(pageSource, /Release latched sensor/);
});

test("robot body labels its physical front in the travel direction", () => {
  assert.match(pageSource, /<b>FRONT ▶<\/b>/);
  assert.match(pageSource, /"wheel-left"/);
  assert.match(pageSource, /"wheel-right"/);
});

test("starter sequence starts and stops both drive motors", () => {
  const starterSource = pageSource.slice(
    pageSource.indexOf("const INITIAL_BLOCKS"),
    pageSource.indexOf("const STARTER_PYTHON"),
  );
  const commands = [...starterSource.matchAll(/command: "([^"]+)"/g)].map((match) => match[1]);
  const state = { left: 0, right: 0 };

  for (const command of commands) {
    const [action, side, direction] = command.split(":");
    if (action === "spin") state[side] = Number(direction);
    if (action === "stop") state[side] = 0;
  }

  assert.ok(commands.indexOf("spin:left:1") < commands.indexOf("spin:right:1"));
  assert.ok(commands.indexOf("spin:right:1") < commands.indexOf("wait:2"));
  assert.ok(commands.indexOf("wait:2") < commands.indexOf("stop:left"));
  assert.ok(commands.indexOf("stop:left") < commands.indexOf("stop:right"));
  assert.deepEqual(state, { left: 0, right: 0 });
});

test("Python while loops recheck live sensor conditions", () => {
  assert.match(pageSource, /match = text\.match\(\/\^while/);
  assert.match(pageSource, /function findLoopToRepeat/);
  assert.match(pageSource, /function findEnclosingLoop/);
  assert.match(pageSource, /if \(action === "while"\)/);
  assert.match(pageSource, /evaluateSensorCondition\(block\.condition \?\? "False", sensors, devices\)/);
  assert.match(pageSource, /Repeating while loop/);
  assert.match(pageSource, /exitingLoopsRef/);
});

test("repeated conditional drive segments stay continuous while the sensor remains true", () => {
  assert.match(pageSource, /function activeMotionLoopConditions/);
  assert.match(pageSource, /evaluateSensorCondition\(condition, sensors, devices\)/);
  assert.match(pageSource, /insideRepeatingLoop \? conditions : null/);
  assert.match(pageSource, /loopMotionCarryRef = useRef/);
  assert.match(pageSource, /loopConditions = activeMotionLoopConditions\(activeProgram, runIndex, sensors, devices\)/);
  assert.match(pageSource, /segment complete — loop continuing/);
  assert.match(pageSource, /became false — continuous loop motion stopped/);
  assert.match(pageSource, /setLeftDirection\(0\); setRightDirection\(0\)/);
});

test("Robot Setup shows and configures all Brain ports", () => {
  assert.match(pageSource, /SMART_DEVICE_TYPES/);
  assert.match(pageSource, /THREE_WIRE_DEVICE_TYPES/);
  assert.match(pageSource, /\["A", "B", "C", "D", "E", "F", "G", "H"\]/);
  assert.match(pageSource, /className=\{classNames\("three-wire-port"/);
  assert.match(pageSource, /setSetupPortType/);
  assert.match(pageSource, /updateSetupDevice/);
  assert.match(pageSource, />Python name</);
  assert.match(pageSource, />Simulator role</);
  assert.match(pageSource, /Clear Port \{selectedSetupPort\}/);
});

test("PLTW setup remains available as a named preset without blocking custom robots", () => {
  assert.match(pageSource, /Use PLTW Testbed Setup/);
  assert.match(pageSource, /function usePLTWTestbed/);
  assert.doesNotMatch(pageSource, /Repair Classroom Setup/);
  const startRunSource = pageSource.slice(pageSource.indexOf("function startRun()"), pageSource.indexOf("function pauseRun"));
  assert.doesNotMatch(startRunSource, /testbedOkay/);
});

test("Program and simulator share one side-by-side workspace", () => {
  assert.match(pageSource, /Program \+ Simulator/);
  assert.match(pageSource, /className="combined-view"/);
  assert.match(pageSource, /className="embedded-simulator"/);
  assert.match(pageSource, /Watch your code run/);
  assert.match(pageSource, /Change these while the highlighted code runs/);
  assert.match(pageSource, /setView\("program"\)/);
  assert.doesNotMatch(pageSource.slice(pageSource.indexOf('<nav className="main-tabs"'), pageSource.indexOf('</nav>')), /\["simulator"/);
});

test("the robot carries a visible LED controlled by led_f", () => {
  assert.match(pageSource, /classNames\("robot-led", sensors\.led && "on"\)/);
  assert.match(pageSource, /aria-label=\{`Robot LED \$\{sensors\.led \? "on" : "off"\}`\}/);
  assert.match(pageSource, /if \(action === "led"\) setSensors/);
});

test("playgrounds provide dynamic obstacles without stopping the running program", () => {
  assert.match(pageSource, /name: "Open Practice"/);
  assert.match(pageSource, /name: "Slalom Course"/);
  assert.match(pageSource, /name: "Warehouse Maze"/);
  assert.match(pageSource, /name: "City Blocks"/);
  assert.match(pageSource, /name: "Delivery Route"/);
  assert.match(pageSource, /name: "Challenge Maze"/);
  assert.match(pageSource, /name: "Demolition Yard"/);
  assert.match(pageSource, /function findRobotObstacle/);
  assert.match(pageSource, /worldObjects\.map/);
  assert.match(pageSource, /code is still RUNNING/);
  assert.match(pageSource, /Collision did not stop the code or motors/);
  assert.match(pageSource, /Choose simulator playground/);
  const collisionSource = pageSource.slice(pageSource.indexOf("if (obstacle)"), pageSource.indexOf("if (collisionLockRef.current) setCollision(false)"));
  assert.doesNotMatch(collisionSource, /setLeftDirection\(0\)|setRightDirection\(0\)|setRunState\("paused"\)/);
});

test("crates can be pushed into visible delivery goals", () => {
  assert.match(pageSource, /behavior: "pushable"/);
  assert.match(pageSource, /function canMovePlaygroundObject/);
  assert.match(pageSource, /function objectReachedGoal/);
  assert.match(pageSource, /setWorldObjects\(\(objects\) => objects\.map/);
  assert.match(pageSource, /className=\{classNames\("crate-goal"/);
  assert.match(pageSource, /"DELIVERED" : "PUSH HERE"/);
  assert.match(pageSource, /reached \$\{candidate\.goal\?\.label/);
});

test("breakaway structures collapse into debris without stopping code", () => {
  assert.match(pageSource, /behavior: "breakable"/);
  assert.match(pageSource, /obstacle\?\.behavior === "breakable"/);
  assert.match(pageSource, /setWorldObjects\(\(objects\) => objects\.filter/);
  assert.match(pageSource, /className="structure-debris"/);
  assert.match(pageSource, /was knocked down\. The code keeps running/);
});

test("reset floor restores moved crates and destroyed structures", () => {
  assert.match(pageSource, /function resetPlayground\(\)/);
  assert.match(pageSource, /setWorldObjects\(clonePlaygroundObjects\(currentPlayground\)\)/);
  assert.match(pageSource, /setDebris\(\[\]\)/);
  assert.match(pageSource, />↺ Reset Floor<\/button>/);
});

test("Python helper explains that while True cannot fall through", () => {
  assert.match(pageSource, /Code after while True cannot run/);
  assert.match(pageSource, /while True never becomes false/);
  assert.match(pageSource, /The if inside it is checked again and again/);
});

test("Python helper warns when an LED off command is outside its if body", () => {
  assert.match(pageSource, /function unconditionalLedOffWarnings/);
  assert.match(pageSource, /always turns the LED off/);
  assert.match(pageSource, /runs after the if every time through the loop/);
  assert.match(pageSource, /Add else: at the same level as if/);
  assert.match(pageSource, /messages\.push\(\.\.\.pythonIndentErrors\(lines\), \.\.\.unconditionalLedOffWarnings\(lines\), \.\.\.competingMotorBranchWarnings\(lines\)\)/);
  assert.match(pageSource, /message\.severity === "warning".*"has-warning"/);
});

test("Python helper identifies a later else that overrides earlier motor motion", () => {
  assert.match(pageSource, /function competingMotorBranchWarnings/);
  assert.match(pageSource, /This is a second, separate if statement/);
  assert.match(pageSource, /Use elif for the second condition and one final else/);
  assert.match(pageSource, /messages\.push\(\.\.\.pythonIndentErrors\(lines\), \.\.\.unconditionalLedOffWarnings\(lines\), \.\.\.competingMotorBranchWarnings\(lines\)\)/);
  assert.match(pageSource, /Both drive motors stopped\$\{block\.sourceLine !== undefined \? ` on line/);
});
