"use client";

import { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "setup" | "program" | "simulator" | "code" | "guide";
type Mode = "blocks" | "python";
type RunState = "ready" | "running" | "paused" | "waiting" | "finished";
type Severity = "error" | "warning" | "tip";
type Block = { id: number; kind: "event" | "motor" | "control" | "sensing" | "looks"; label: string; command: string; sourceLine?: number; indent?: number; condition?: string };
type Device = { port: string; name: string; type: string; role?: string; expected: string };
type SensorState = { bumper: boolean; limit: boolean; light: number; line: number; pot: number; led: boolean };
type PlaygroundId = "open" | "slalom" | "warehouse" | "city" | "delivery" | "challenge" | "demolition";
type PlaygroundGoal = { x: number; y: number; width: number; height: number; label: string };
type PlaygroundObstacle = { id: string; x: number; y: number; width: number; height: number; kind: "wall" | "crate" | "structure"; label: string; behavior?: "solid" | "pushable" | "breakable"; goal?: PlaygroundGoal };
type PlaygroundDebris = { id: string; x: number; y: number; width: number; height: number };
type Playground = { id: PlaygroundId; name: string; description: string; theme: string; start: typeof DEFAULT_ROBOT; obstacles: PlaygroundObstacle[] };
type SavedProject = { name: string; savedAt: string; devices: Device[]; blocks: Block[]; python: string };
type ToolboxEntry = { label: string; command: string; kind: Block["kind"]; python: string; displayPython?: string };
type ToolboxGroup = { heading?: string; detail?: string; entries: ToolboxEntry[] };
type PythonOptionField = { key: string; label: string; type: "select" | "number" | "text"; defaultValue: string; choices?: string[]; min?: number; max?: number; step?: number };
type PythonOptionTemplate = { title: string; description: string; fields: PythonOptionField[]; build: (values: Record<string, string>) => string };

const DEFAULT_ROBOT = { x: 16, y: 50, heading: 0 };
const STEP_DELAY_MS = 180;
const MIN_STEP_DELAY_MS = 12;
const FAST_CODE_SPEED = 12;
const PLAYGROUNDS: Playground[] = [
  { id: "open", name: "Open Practice", description: "An open grid for testing distance and turns.", theme: "open", start: DEFAULT_ROBOT, obstacles: [] },
  { id: "slalom", name: "Slalom Course", description: "Navigate around alternating barriers.", theme: "slalom", start: DEFAULT_ROBOT, obstacles: [
    { id: "slalom-1", x: 34, y: 8, width: 4, height: 36, kind: "wall", label: "Barrier 1" },
    { id: "slalom-2", x: 54, y: 56, width: 4, height: 36, kind: "wall", label: "Barrier 2" },
    { id: "slalom-3", x: 74, y: 8, width: 4, height: 36, kind: "wall", label: "Barrier 3" },
  ] },
  { id: "warehouse", name: "Warehouse Maze", description: "Drive between shelves and push both crates into their marked docks.", theme: "warehouse", start: DEFAULT_ROBOT, obstacles: [
    { id: "shelf-1", x: 31, y: 10, width: 5, height: 50, kind: "wall", label: "Shelf A" },
    { id: "shelf-2", x: 52, y: 40, width: 5, height: 50, kind: "wall", label: "Shelf B" },
    { id: "crate-1", x: 68, y: 14, width: 10, height: 14, kind: "crate", behavior: "pushable", label: "Crate A", goal: { x: 84, y: 12, width: 12, height: 18, label: "Dock A" } },
    { id: "crate-2", x: 72, y: 70, width: 10, height: 14, kind: "crate", behavior: "pushable", label: "Crate B", goal: { x: 84, y: 68, width: 12, height: 18, label: "Dock B" } },
  ] },
  { id: "city", name: "City Blocks", description: "Plan turns through a small street grid.", theme: "city", start: DEFAULT_ROBOT, obstacles: [
    { id: "city-1", x: 33, y: 12, width: 13, height: 24, kind: "wall", label: "Building A" },
    { id: "city-2", x: 33, y: 64, width: 13, height: 24, kind: "wall", label: "Building B" },
    { id: "city-3", x: 66, y: 12, width: 13, height: 24, kind: "wall", label: "Building C" },
    { id: "city-4", x: 66, y: 64, width: 13, height: 24, kind: "wall", label: "Building D" },
  ] },
  { id: "delivery", name: "Delivery Route", description: "Push each package into one of the marked delivery bays.", theme: "delivery", start: DEFAULT_ROBOT, obstacles: [
    { id: "delivery-1", x: 30, y: 13, width: 9, height: 13, kind: "crate", behavior: "pushable", label: "Package A", goal: { x: 84, y: 8, width: 11, height: 17, label: "Bay A" } },
    { id: "delivery-2", x: 40, y: 67, width: 9, height: 13, kind: "crate", behavior: "pushable", label: "Package B", goal: { x: 84, y: 29, width: 11, height: 17, label: "Bay B" } },
    { id: "delivery-3", x: 54, y: 30, width: 9, height: 13, kind: "crate", behavior: "pushable", label: "Package C", goal: { x: 84, y: 50, width: 11, height: 17, label: "Bay C" } },
    { id: "delivery-4", x: 67, y: 70, width: 9, height: 13, kind: "crate", behavior: "pushable", label: "Package D", goal: { x: 84, y: 71, width: 11, height: 17, label: "Bay D" } },
  ] },
  { id: "challenge", name: "Challenge Maze", description: "A longer route with thin walls and several choices.", theme: "challenge", start: DEFAULT_ROBOT, obstacles: [
    { id: "challenge-1", x: 27, y: 8, width: 4, height: 42, kind: "wall", label: "Wall A" },
    { id: "challenge-2", x: 43, y: 50, width: 4, height: 42, kind: "wall", label: "Wall B" },
    { id: "challenge-3", x: 59, y: 8, width: 4, height: 42, kind: "wall", label: "Wall C" },
    { id: "challenge-4", x: 75, y: 50, width: 4, height: 42, kind: "wall", label: "Wall D" },
    { id: "challenge-5", x: 84, y: 18, width: 8, height: 13, kind: "crate", behavior: "pushable", label: "Finish crate", goal: { x: 84, y: 72, width: 10, height: 16, label: "Finish zone" } },
  ] },
  { id: "demolition", name: "Demolition Yard", description: "Push cargo to its target and knock down the practice structure.", theme: "demolition", start: DEFAULT_ROBOT, obstacles: [
    { id: "demo-wall-1", x: 43, y: 8, width: 3, height: 28, kind: "wall", label: "Safety wall" },
    { id: "demo-wall-2", x: 43, y: 64, width: 3, height: 28, kind: "wall", label: "Safety wall" },
    { id: "demo-crate", x: 34, y: 43, width: 9, height: 14, kind: "crate", behavior: "pushable", label: "Practice crate", goal: { x: 73, y: 70, width: 12, height: 18, label: "Cargo target" } },
    { id: "demo-structure", x: 70, y: 34, width: 13, height: 25, kind: "structure", behavior: "breakable", label: "Breakaway tower" },
  ] },
];

function clonePlaygroundObjects(playground: Playground) {
  return playground.obstacles.map((obstacle) => ({ ...obstacle, goal: obstacle.goal ? { ...obstacle.goal } : undefined }));
}

function findRobotObstacle(obstacles: PlaygroundObstacle[], x: number, y: number) {
  const robotPadding = 5;
  return obstacles.find((obstacle) => x >= obstacle.x - robotPadding && x <= obstacle.x + obstacle.width + robotPadding && y >= obstacle.y - robotPadding && y <= obstacle.y + obstacle.height + robotPadding);
}

function rectanglesOverlap(first: PlaygroundObstacle, second: PlaygroundObstacle) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
}

function canMovePlaygroundObject(candidate: PlaygroundObstacle, obstacles: PlaygroundObstacle[]) {
  if (candidate.x < 2 || candidate.y < 2 || candidate.x + candidate.width > 98 || candidate.y + candidate.height > 98) return false;
  return !obstacles.some((obstacle) => obstacle.id !== candidate.id && rectanglesOverlap(candidate, obstacle));
}

function objectReachedGoal(obstacle: PlaygroundObstacle) {
  if (!obstacle.goal) return false;
  const centerX = obstacle.x + obstacle.width / 2; const centerY = obstacle.y + obstacle.height / 2;
  return centerX >= obstacle.goal.x && centerX <= obstacle.goal.x + obstacle.goal.width && centerY >= obstacle.goal.y && centerY <= obstacle.goal.y + obstacle.goal.height;
}

const EXPECTED_DEVICES: Device[] = [
  { port: "1", name: "left_motor", type: "Smart Motor", role: "Left drive", expected: "left_motor" },
  { port: "10", name: "right_motor", type: "Smart Motor", role: "Right drive", expected: "right_motor" },
  { port: "A", name: "bumper_a", type: "Bumper", expected: "bumper_a" },
  { port: "B", name: "limit_switch_b", type: "Limit Switch", expected: "limit_switch_b" },
  { port: "C", name: "light_c", type: "Light Sensor", expected: "light_c" },
  { port: "D", name: "line_tracker_d", type: "Line Tracker", expected: "line_tracker_d" },
  { port: "E", name: "potentiometer_e", type: "Potentiometer", expected: "potentiometer_e" },
  { port: "F", name: "led_f", type: "LED", expected: "led_f" },
];
const SMART_DEVICE_TYPES = ["Smart Motor", "Distance Sensor", "Optical Sensor", "Rotation Sensor", "Inertial Sensor", "Vision Sensor", "GPS Sensor"];
const THREE_WIRE_DEVICE_TYPES = ["Bumper", "Limit Switch", "Light Sensor", "Line Tracker", "Potentiometer", "LED"];
function defaultDeviceName(type: string, port: string) {
  const base = type.toLowerCase().replace(/\s+(sensor|switch)$/, "").replace(/[^a-z0-9]+/g, "_");
  return `${base}_${port.toLowerCase()}`;
}
const INITIAL_BLOCKS: Block[] = [
  { id: 1, kind: "event", label: "when started", command: "start" },
  { id: 2, kind: "motor", label: "set left_motor velocity to 40%", command: "velocity:left:40" },
  { id: 3, kind: "motor", label: "set right_motor velocity to 40%", command: "velocity:right:40" },
  { id: 4, kind: "motor", label: "spin left_motor forward", command: "spin:left:1" },
  { id: 5, kind: "motor", label: "spin right_motor forward", command: "spin:right:1" },
  { id: 6, kind: "control", label: "wait 2 seconds", command: "wait:2" },
  { id: 7, kind: "motor", label: "stop left_motor", command: "stop:left" },
  { id: 8, kind: "motor", label: "stop right_motor", command: "stop:right" },
  { id: 9, kind: "looks", label: "print Drive complete", command: "print:Drive complete" },
];
const STARTER_PYTHON = `from vex import *

brain = Brain()

# Your Classroom Testbed devices are configured for you.
left_motor.set_velocity(40, PERCENT)
right_motor.set_velocity(40, PERCENT)
left_motor.spin(FORWARD)
right_motor.spin(FORWARD)
wait(2, SECONDS)
left_motor.stop()
right_motor.stop()
brain.screen.print("Drive complete")`;

const BASE_TOOLBOX: Record<string, { color: string; entries: ToolboxEntry[] }> = {
  Events: { color: "#e9b928", entries: [{ label: "when started", command: "start", kind: "event", python: "# Program starts here" }] },
  Motion: { color: "#4f79d9", entries: [
    { label: "drivetrain drive forward for 300 mm", command: "drive:300", kind: "motor", python: "drivetrain.drive_for(FORWARD, 300, MM)" },
    { label: "drivetrain turn right for 90 degrees", command: "turn:90", kind: "motor", python: "drivetrain.turn_for(RIGHT, 90, DEGREES)" },
    { label: "stop drivetrain", command: "stop:both", kind: "motor", python: "drivetrain.stop()" },
    { label: "set left_motor velocity to 50%", command: "velocity:left:50", kind: "motor", python: "left_motor.set_velocity(50, PERCENT)" },
    { label: "set right_motor velocity to 50%", command: "velocity:right:50", kind: "motor", python: "right_motor.set_velocity(50, PERCENT)" },
    { label: "spin left_motor forward", command: "spin:left:1", kind: "motor", python: "left_motor.spin(FORWARD)" },
    { label: "spin right_motor forward", command: "spin:right:1", kind: "motor", python: "right_motor.spin(FORWARD)" },
    { label: "stop left_motor", command: "stop:left", kind: "motor", python: "left_motor.stop()" },
    { label: "stop right_motor", command: "stop:right", kind: "motor", python: "right_motor.stop()" },
  ] },
  Looks: { color: "#8e62cc", entries: [
    { label: "print Hello!", command: "print:Hello!", kind: "looks", python: "brain.screen.print(\"Hello!\")" },
    { label: "clear brain screen", command: "clear", kind: "looks", python: "brain.screen.clear_screen()" },
  ] },
  "3-Wire": { color: "#42a5a8", entries: [] },
  Control: { color: "#e59a32", entries: [
    { label: "wait 1 second", command: "wait:1", kind: "control", python: "wait(1, SECONDS)" },
    { label: "for count in range(4)", command: "repeat:4", kind: "control", python: "for count in range(4):\n    pass" },
    { label: "if condition", command: "if", kind: "control", python: "if condition:\n    pass" },
    { label: "if / else", command: "ifelse", kind: "control", python: "if condition:\n    pass\nelse:\n    pass" },
    { label: "if / elif / else", command: "ifelifelse", kind: "control", python: "if condition_a:\n    pass\nelif condition_b:\n    pass\nelse:\n    pass" },
    { label: "while condition", command: "while", kind: "control", python: "while condition:\n    pass" },
    { label: "break", command: "break", kind: "control", python: "break" },
    { label: "stop program", command: "programstop", kind: "control", python: "brain.program_stop()" },
    { label: "pass", command: "pass", kind: "control", python: "pass" },
  ] },
  Operators: { color: "#5ba45c", entries: [
    { label: "value > 50", command: "operator", kind: "control", python: "value > 50" },
    { label: "and / or", command: "operator", kind: "control", python: "condition_a and condition_b" },
  ] },
  Variables: { color: "#d66ca2", entries: [{ label: "set sensor_value to 0", command: "variable", kind: "control", python: "sensor_value = 0" }] },
};

function buildMotionGroups(devices: Device[]): ToolboxGroup[] {
  const motorNames = devices.filter((device) => device.type === "Smart Motor").map((device) => device.name);
  const motorName = motorNames[0] ?? "motor";
  const motorEntry = (displayPython: string, command: string, python: string): ToolboxEntry => ({
    label: displayPython,
    command,
    kind: "motor",
    python,
    displayPython,
  });
  return [
    { heading: "Actions", entries: [
      motorEntry("motor.spin(FORWARD)", `motor-spin:${motorName}`, `${motorName}.spin(FORWARD)`),
      motorEntry("motor.spin_for(FORWARD, 90, DEGREES)", `motor-spin-for:${motorName}`, `${motorName}.spin_for(FORWARD, 90, DEGREES)`),
      motorEntry("motor.spin_to_position(90, DEGREES)", `motor-spin-to:${motorName}`, `${motorName}.spin_to_position(90, DEGREES)`),
      motorEntry("motor.spin(FORWARD, 10.0, VOLT)", `motor-spin-voltage:${motorName}`, `${motorName}.spin(FORWARD, 10.0, VOLT)`),
      motorEntry("motor.stop()", `motor-stop:${motorName}`, `${motorName}.stop()`),
    ] },
    { heading: "Mutators", entries: [
      motorEntry("motor.set_position(0, DEGREES)", `motor-set-position:${motorName}`, `${motorName}.set_position(0, DEGREES)`),
      motorEntry("motor.set_velocity(50, PERCENT)", `motor-velocity:${motorName}`, `${motorName}.set_velocity(50, PERCENT)`),
      motorEntry("motor.set_stopping(BRAKE)", `motor-set-stopping:${motorName}`, `${motorName}.set_stopping(BRAKE)`),
      motorEntry("motor.set_max_torque(50, PERCENT)", `motor-max-torque:${motorName}`, `${motorName}.set_max_torque(50, PERCENT)`),
      motorEntry("motor.set_timeout(1, SECONDS)", `motor-timeout:${motorName}`, `${motorName}.set_timeout(1, SECONDS)`),
    ] },
    { heading: "Getters", entries: [
      motorEntry("motor.is_done()", `motor-getter:${motorName}:is_done`, `${motorName}.is_done()`),
      motorEntry("motor.is_spinning()", `motor-getter:${motorName}:is_spinning`, `${motorName}.is_spinning()`),
      motorEntry("motor.position(DEGREES)", `motor-getter:${motorName}:position`, `${motorName}.position(DEGREES)`),
      motorEntry("motor.velocity(PERCENT)", `motor-getter:${motorName}:velocity`, `${motorName}.velocity(PERCENT)`),
      motorEntry("motor.current(CurrentUnits.AMP)", `motor-getter:${motorName}:current`, `${motorName}.current(CurrentUnits.AMP)`),
      motorEntry("motor.power(PowerUnits.WATT)", `motor-getter:${motorName}:power`, `${motorName}.power(PowerUnits.WATT)`),
      motorEntry("motor.torque(TorqueUnits.NM)", `motor-getter:${motorName}:torque`, `${motorName}.torque(TorqueUnits.NM)`),
      motorEntry("motor.efficiency(PERCENT)", `motor-getter:${motorName}:efficiency`, `${motorName}.efficiency(PERCENT)`),
      motorEntry("motor.temperature(PERCENT)", `motor-getter:${motorName}:temperature`, `${motorName}.temperature(PERCENT)`),
    ] },
  ];
}

function buildThreeWireGroups(devices: Device[], mode: Mode): ToolboxGroup[] {
  return devices.flatMap((device) => {
    const direct = (label: string, command: string, python: string, kind: Block["kind"] = "sensing"): ToolboxEntry => ({ label, command, python, kind });
    let entries: ToolboxEntry[] = [];
    if (device.type === "Bumper") entries = [
      direct(`${device.name} pressing?`, "read:bumper", `${device.name}.pressing()`),
      ...(mode === "python" ? [
        direct(`${device.name} pressed callback`, `sensorevent:${device.name}:pressed`, `${device.name}.pressed(callback)`),
        direct(`${device.name} released callback`, `sensorevent:${device.name}:released`, `${device.name}.released(callback)`),
      ] : []),
    ];
    if (device.type === "Limit Switch") entries = [
      direct(`${device.name} pressing?`, "read:limit", `${device.name}.pressing()`),
      ...(mode === "python" ? [
        direct(`${device.name} pressed callback`, `sensorevent:${device.name}:pressed`, `${device.name}.pressed(callback)`),
        direct(`${device.name} released callback`, `sensorevent:${device.name}:released`, `${device.name}.released(callback)`),
      ] : []),
    ];
    if (device.type === "Light Sensor") entries = [direct(`${device.name} brightness`, "read:light", `${device.name}.brightness(PERCENT)`)];
    if (device.type === "Line Tracker") entries = [direct(`${device.name} reflectivity`, "read:line", `${device.name}.reflectivity(PERCENT)`)];
    if (device.type === "Potentiometer") entries = [direct(`${device.name} angle`, "read:pot", `${device.name}.angle(PERCENT)`)];
    if (device.type === "LED") entries = [
      direct(`turn ${device.name} on`, "led:1", `${device.name}.on()`, "looks"),
      direct(`turn ${device.name} off`, "led:0", `${device.name}.off()`, "looks"),
    ];
    if (!entries.length) return [];
    return [{ heading: device.name, detail: `${device.type} • Port ${device.port}`, entries }];
  });
}

function classNames(...names: Array<string | false | null | undefined>) { return names.filter(Boolean).join(" "); }
function getPythonOptionTemplate(entry: ToolboxEntry, devices: Device[] = EXPECTED_DEVICES): PythonOptionTemplate | null {
  const [action, target, amount] = entry.command.split(":");
  const motorNames = devices.filter((device) => device.type === "Smart Motor").map((device) => device.name);
  const availableMotors = motorNames.length ? motorNames : ["motor"];
  const selectedMotor = availableMotors.includes(target) ? target : availableMotors[0];
  const motorField: PythonOptionField = { key: "motor", label: "Motor", type: "select", defaultValue: selectedMotor, choices: availableMotors };
  if (action === "motor-spin") return { title: "Motor spin options", description: "Choose a configured motor and its direction.", fields: [
    motorField,
    { key: "direction", label: "Direction", type: "select", defaultValue: "FORWARD", choices: ["FORWARD", "REVERSE"] },
  ], build: (v) => `${v.motor}.spin(${v.direction})` };
  if (action === "motor-spin-for") return { title: "Spin for options", description: "Choose a motor, direction, amount, and rotation unit.", fields: [
    motorField,
    { key: "direction", label: "Direction", type: "select", defaultValue: "FORWARD", choices: ["FORWARD", "REVERSE"] },
    { key: "amount", label: "Amount", type: "number", defaultValue: "90", min: 0, step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "DEGREES", choices: ["DEGREES", "TURNS"] },
  ], build: (v) => `${v.motor}.spin_for(${v.direction}, ${v.amount}, ${v.unit})` };
  if (action === "motor-spin-to") return { title: "Spin to position options", description: "Choose a motor and its target position.", fields: [
    motorField,
    { key: "position", label: "Position", type: "number", defaultValue: "90", step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "DEGREES", choices: ["DEGREES", "TURNS"] },
  ], build: (v) => `${v.motor}.spin_to_position(${v.position}, ${v.unit})` };
  if (action === "motor-spin-voltage") return { title: "Motor voltage options", description: "Choose a motor, direction, and voltage.", fields: [
    motorField,
    { key: "direction", label: "Direction", type: "select", defaultValue: "FORWARD", choices: ["FORWARD", "REVERSE"] },
    { key: "voltage", label: "Voltage", type: "number", defaultValue: "10.0", min: 0, max: 12, step: 0.1 },
  ], build: (v) => `${v.motor}.spin(${v.direction}, ${v.voltage}, VOLT)` };
  if (action === "motor-stop") return { title: "Motor stop options", description: "Choose a configured motor and stopping mode.", fields: [
    motorField,
    { key: "mode", label: "Stopping mode", type: "select", defaultValue: "BRAKE", choices: ["BRAKE", "COAST", "HOLD"] },
  ], build: (v) => `${v.motor}.stop(${v.mode})` };
  if (action === "motor-set-position") return { title: "Set motor position", description: "Set the motor encoder position.", fields: [
    motorField,
    { key: "position", label: "Position", type: "number", defaultValue: "0", step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "DEGREES", choices: ["DEGREES", "TURNS"] },
  ], build: (v) => `${v.motor}.set_position(${v.position}, ${v.unit})` };
  if (action === "motor-velocity") return { title: "Motor velocity options", description: "Choose a configured motor and its speed.", fields: [
    motorField,
    { key: "velocity", label: "Velocity", type: "number", defaultValue: "50", min: 0, step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "PERCENT", choices: ["PERCENT", "RPM"] },
  ], build: (v) => `${v.motor}.set_velocity(${v.velocity}, ${v.unit})` };
  if (action === "motor-set-stopping") return { title: "Set stopping mode", description: "Choose how a configured motor should stop.", fields: [
    motorField,
    { key: "mode", label: "Stopping mode", type: "select", defaultValue: "BRAKE", choices: ["BRAKE", "COAST", "HOLD"] },
  ], build: (v) => `${v.motor}.set_stopping(${v.mode})` };
  if (action === "motor-max-torque") return { title: "Set maximum torque", description: "Choose a motor and its maximum torque.", fields: [
    motorField,
    { key: "torque", label: "Maximum torque", type: "number", defaultValue: "50", min: 0, step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "PERCENT", choices: ["PERCENT", "NM"] },
  ], build: (v) => `${v.motor}.set_max_torque(${v.torque}, ${v.unit})` };
  if (action === "motor-timeout") return { title: "Set motor timeout", description: "Choose a motor and timeout duration.", fields: [
    motorField,
    { key: "duration", label: "Duration", type: "number", defaultValue: "1", min: 0, step: 0.1 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "SECONDS", choices: ["SECONDS", "MSEC"] },
  ], build: (v) => `${v.motor}.set_timeout(${v.duration}, ${v.unit})` };
  if (action === "motor-getter") {
    const getterCalls: Record<string, string> = {
      is_done: "is_done()",
      is_spinning: "is_spinning()",
      position: "position(DEGREES)",
      velocity: "velocity(PERCENT)",
      current: "current(CurrentUnits.AMP)",
      power: "power(PowerUnits.WATT)",
      torque: "torque(TorqueUnits.NM)",
      efficiency: "efficiency(PERCENT)",
      temperature: "temperature(PERCENT)",
    };
    return { title: "Motor value options", description: "Choose which configured motor supplies this value.", fields: [motorField], build: (v) => `${v.motor}.${getterCalls[amount] ?? "is_done()"}` };
  }
  if (action === "drive") return { title: "Drive options", description: "Choose the direction, distance, and measurement unit.", fields: [
    { key: "direction", label: "Direction", type: "select", defaultValue: "FORWARD", choices: ["FORWARD", "REVERSE"] },
    { key: "distance", label: "Distance", type: "number", defaultValue: amount || "300", min: 0, step: 10 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "MM", choices: ["MM", "INCHES"] },
  ], build: (v) => `drivetrain.drive_for(${v.direction}, ${v.distance}, ${v.unit})` };
  if (action === "turn") return { title: "Turn options", description: "Choose which way and how far the drivetrain turns.", fields: [
    { key: "direction", label: "Direction", type: "select", defaultValue: "RIGHT", choices: ["RIGHT", "LEFT"] },
    { key: "angle", label: "Angle", type: "number", defaultValue: amount || "90", min: 0, step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "DEGREES", choices: ["DEGREES", "TURNS"] },
  ], build: (v) => `drivetrain.turn_for(${v.direction}, ${v.angle}, ${v.unit})` };
  if (entry.python === "drivetrain.stop()") return { title: "Drivetrain stop options", description: "Choose how the drivetrain should stop.", fields: [
    { key: "mode", label: "Stopping mode", type: "select", defaultValue: "BRAKE", choices: ["BRAKE", "COAST", "HOLD"] },
  ], build: (v) => `drivetrain.stop(${v.mode})` };
  if (action === "velocity") return { title: "Motor velocity options", description: "Choose a motor and its speed.", fields: [
    { key: "motor", label: "Motor", type: "select", defaultValue: target === "right" ? "right_motor" : "left_motor", choices: ["left_motor", "right_motor"] },
    { key: "velocity", label: "Velocity", type: "number", defaultValue: amount || "50", min: 0, step: 5 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "PERCENT", choices: ["PERCENT", "RPM"] },
  ], build: (v) => `${v.motor}.set_velocity(${v.velocity}, ${v.unit})` };
  if (action === "spin") return { title: "Motor spin options", description: "Choose the motor and its direction.", fields: [
    { key: "motor", label: "Motor", type: "select", defaultValue: target === "right" ? "right_motor" : "left_motor", choices: ["left_motor", "right_motor"] },
    { key: "direction", label: "Direction", type: "select", defaultValue: amount === "-1" ? "REVERSE" : "FORWARD", choices: ["FORWARD", "REVERSE"] },
  ], build: (v) => `${v.motor}.spin(${v.direction})` };
  if (action === "stop" && (target === "left" || target === "right")) return { title: "Motor stop options", description: "Choose the individual motor and how it should stop.", fields: [
    { key: "motor", label: "Motor", type: "select", defaultValue: target === "right" ? "right_motor" : "left_motor", choices: ["left_motor", "right_motor"] },
    { key: "mode", label: "Stopping mode", type: "select", defaultValue: "BRAKE", choices: ["BRAKE", "COAST", "HOLD"] },
  ], build: (v) => `${v.motor}.stop(${v.mode})` };
  if (action === "print") return { title: "Brain print options", description: "Enter the text that should appear on the V5 Brain.", fields: [
    { key: "text", label: "Text", type: "text", defaultValue: target || "Hello!" },
  ], build: (v) => `brain.screen.print(${JSON.stringify(v.text)})` };
  if (action === "led") return { title: "LED options", description: "Choose whether the classroom LED turns on or off.", fields: [
    { key: "state", label: "LED state", type: "select", defaultValue: target === "0" ? "off" : "on", choices: ["on", "off"] },
  ], build: (v) => `led_f.${v.state}()` };
  if (action === "wait") return { title: "Wait options", description: "Choose the duration and time unit.", fields: [
    { key: "duration", label: "Duration", type: "number", defaultValue: target || "1", min: 0, step: 0.1 },
    { key: "unit", label: "Unit", type: "select", defaultValue: "SECONDS", choices: ["SECONDS", "MSEC"] },
  ], build: (v) => `wait(${v.duration}, ${v.unit})` };
  if (action === "repeat") return { title: "Repeat options", description: "Choose how many times the indented code repeats.", fields: [
    { key: "count", label: "Repeat count", type: "number", defaultValue: target || "4", min: 1, step: 1 },
  ], build: (v) => `for count in range(${v.count}):\n    pass` };
  if (action === "if") return { title: "If options", description: "Enter a condition from Sensing, Operators, or Variables.", fields: [
    { key: "condition", label: "Condition", type: "text", defaultValue: "condition" },
  ], build: (v) => `if ${v.condition}:\n    pass` };
  if (action === "ifelse") return { title: "If / else options", description: "Enter the condition that chooses between two paths.", fields: [
    { key: "condition", label: "Condition", type: "text", defaultValue: "condition" },
  ], build: (v) => `if ${v.condition}:\n    pass\nelse:\n    pass` };
  if (action === "ifelifelse") return { title: "If / elif / else options", description: "Enter the two conditions checked in order.", fields: [
    { key: "first", label: "First condition", type: "text", defaultValue: "condition_a" },
    { key: "second", label: "Second condition", type: "text", defaultValue: "condition_b" },
  ], build: (v) => `if ${v.first}:\n    pass\nelif ${v.second}:\n    pass\nelse:\n    pass` };
  if (action === "while") return { title: "While options", description: "Enter the condition that keeps the loop running.", fields: [
    { key: "condition", label: "Condition", type: "text", defaultValue: "condition" },
  ], build: (v) => `while ${v.condition}:\n    pass` };
  if (action === "operator" && entry.python.includes(">")) return { title: "Comparison options", description: "Build a comparison for an if or while condition.", fields: [
    { key: "value", label: "Value name", type: "text", defaultValue: "value" },
    { key: "operator", label: "Comparison", type: "select", defaultValue: ">", choices: [">", "<", ">=", "<=", "==", "!="] },
    { key: "number", label: "Number", type: "number", defaultValue: "50", step: 1 },
  ], build: (v) => `${v.value} ${v.operator} ${v.number}` };
  if (action === "operator") return { title: "Logic options", description: "Join two conditions with and or or.", fields: [
    { key: "first", label: "First condition", type: "text", defaultValue: "condition_a" },
    { key: "join", label: "Join with", type: "select", defaultValue: "and", choices: ["and", "or"] },
    { key: "second", label: "Second condition", type: "text", defaultValue: "condition_b" },
  ], build: (v) => `${v.first} ${v.join} ${v.second}` };
  if (action === "variable") return { title: "Variable options", description: "Choose the variable name and starting value.", fields: [
    { key: "name", label: "Variable name", type: "text", defaultValue: "sensor_value" },
    { key: "value", label: "Starting value", type: "number", defaultValue: "0", step: 1 },
  ], build: (v) => `${v.name} = ${v.value}` };
  return null;
}
function PythonSyntax({ code }: { code: string }) {
  const pattern = /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:from|import|if|else|elif|while|not|for|in|range|and|or|break|pass|True|False)\b|\b(?:FORWARD|REVERSE|LEFT|RIGHT|PERCENT|RPM|SECONDS|MSEC|MM|INCHES|DEGREES|TURNS|BRAKE|COAST|HOLD|VOLT|CurrentUnits|PowerUnits|TorqueUnits|AMP|WATT|NM)\b|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_]\w*(?=\s*\())/gm;
  return <>{code.split(pattern).map((token, index) => {
    let tone = "";
    if (token.startsWith("#")) tone = "syn-comment";
    else if (/^["']/.test(token)) tone = "syn-string";
    else if (/^\d/.test(token)) tone = "syn-number";
    else if (/^(from|import|if|else|elif|while|not|for|in|range|and|or|break|pass|True|False)$/.test(token)) tone = "syn-keyword";
    else if (/^(FORWARD|REVERSE|LEFT|RIGHT|PERCENT|RPM|SECONDS|MSEC|MM|INCHES|DEGREES|TURNS|BRAKE|COAST|HOLD|VOLT|CurrentUnits|PowerUnits|TorqueUnits|AMP|WATT|NM)$/.test(token)) tone = "syn-constant";
    else if (/^[a-zA-Z_]\w*$/.test(token)) tone = "syn-method";
    return tone ? <span className={tone} key={index}>{token}</span> : token;
  })}</>;
}
function insertPythonSnippet(source: string, snippet: string, selectionStart: number, selectionEnd: number) {
  const start = Math.max(0, Math.min(selectionStart, source.length));
  const end = Math.max(start, Math.min(selectionEnd, source.length));
  const before = source.slice(0, start); const after = source.slice(end);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineBeforeCursor = before.slice(lineStart);
  const indent = lineBeforeCursor.match(/^\s*/)?.[0] ?? "";
  const formattedSnippet = snippet.split("\n").map((line, index) => index === 0 ? line : `${indent}${line}`).join("\n");
  return { value: `${before}${formattedSnippet}${after}`, caret: before.length + formattedSnippet.length };
}
function changePythonIndent(source: string, selectionStart: number, selectionEnd: number, outdent: boolean) {
  const start = Math.max(0, Math.min(selectionStart, source.length));
  const end = Math.max(start, Math.min(selectionEnd, source.length));
  if (start === end && !outdent) {
    return { value: `${source.slice(0, start)}    ${source.slice(end)}`, selectionStart: start + 4, selectionEnd: start + 4 };
  }
  const firstLineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lastSelectedCharacter = end > start && source[end - 1] === "\n" ? end - 1 : end;
  const nextLineBreak = source.indexOf("\n", lastSelectedCharacter);
  const blockEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  const lines = source.slice(firstLineStart, blockEnd).split("\n");
  if (outdent) {
    const removed = lines.map((line) => line.match(/^(?: {1,4}|\t)/)?.[0].length ?? 0);
    const replacement = lines.map((line, index) => line.slice(removed[index])).join("\n");
    const removedTotal = removed.reduce((sum, amount) => sum + amount, 0);
    const adjustedStart = start === firstLineStart ? start : Math.max(firstLineStart, start - removed[0]);
    return { value: `${source.slice(0, firstLineStart)}${replacement}${source.slice(blockEnd)}`, selectionStart: adjustedStart, selectionEnd: Math.max(adjustedStart, end - removedTotal) };
  }
  const replacement = lines.map((line) => `    ${line}`).join("\n");
  const adjustedStart = start === firstLineStart ? start : start + 4;
  return { value: `${source.slice(0, firstLineStart)}${replacement}${source.slice(blockEnd)}`, selectionStart: adjustedStart, selectionEnd: end + lines.length * 4 };
}
function blockToPython(block: Block) {
  const [action, a, b] = block.command.split(":");
  if (action === "start") return "# Program starts here";
  if (action === "velocity") return `${a === "left" ? "left_motor" : "right_motor"}.set_velocity(${b}, PERCENT)`;
  if (action === "spin") return `${a === "left" ? "left_motor" : "right_motor"}.spin(${b === "-1" ? "REVERSE" : "FORWARD"})`;
  if (action === "stop") return a === "both" ? "left_motor.stop()\nright_motor.stop()" : `${a}_motor.stop()`;
  if (action === "wait") return `wait(${a}, SECONDS)`;
  if (action === "waitsensor") return `while not ${a === "bumper" ? "bumper_a" : "limit_switch_b"}.pressing():\n    wait(20, MSEC)`;
  if (action === "print") return `brain.screen.print(${JSON.stringify(a)})`;
  if (action === "clear") return "brain.screen.clear_screen()";
  if (action === "led") return `led_f.${a === "1" ? "on" : "off"}()`;
  if (action === "drive") return `drivetrain.drive_for(FORWARD, ${a}, MM)`;
  if (action === "turn") return `drivetrain.turn_for(RIGHT, ${a}, DEGREES)`;
  if (action === "read") {
    const reads: Record<string, string> = { bumper: "bumper_a.pressing()", limit: "limit_switch_b.pressing()", light: "light_c.brightness(PERCENT)", line: "line_tracker_d.reflectivity(PERCENT)", pot: "potentiometer_e.angle(PERCENT)" };
    return `brain.screen.print(${reads[a]})`;
  }
  return `# ${block.label}`;
}
function pythonToBlocks(code: string, devices: Device[]): Block[] {
  const parsed: Block[] = [];
  const driveMotorSides = new Map(devices.filter((device) => device.type === "Smart Motor" && (device.role === "Left drive" || device.role === "Right drive")).map((device) => [device.name, device.role === "Left drive" ? "left" : "right"]));
  const ledNames = new Set(devices.filter((device) => device.type === "LED").map((device) => device.name));
  code.split("\n").forEach((line, lineIndex) => {
    const text = line.trim();
    if (!text || text.startsWith("#") || text === "from vex import *" || text === "brain = Brain()") return;
    const indent = (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "    ").length;
    const add = (kind: Block["kind"], label: string, command: string, condition?: string) => parsed.push({ id: 1000 + lineIndex, kind, label, command, sourceLine: lineIndex, indent, condition });
    let match = text.match(/^drivetrain\.(set_drive_velocity|set_turn_velocity)\(\s*(-?[\d.]+)\s*,\s*(PERCENT|RPM)/);
    if (match) return add("motor", `set drivetrain ${match[1] === "set_turn_velocity" ? "turn" : "drive"} velocity to ${match[2]} ${match[3].toLowerCase()}`, `velocity:both:${match[2]}`);
    match = text.match(/^([a-zA-Z_]\w*)\.set_velocity\(\s*(\d+)/);
    if (match && driveMotorSides.has(match[1])) return add("motor", `set ${match[1]} velocity to ${match[2]}%`, `velocity:${driveMotorSides.get(match[1])}:${match[2]}`);
    match = text.match(/^([a-zA-Z_]\w*)\.spin\((FORWARD|REVERSE)/);
    if (match && driveMotorSides.has(match[1])) return add("motor", `spin ${match[1]} ${match[2].toLowerCase()}`, `spin:${driveMotorSides.get(match[1])}:${match[2] === "FORWARD" ? "1" : "-1"}`);
    match = text.match(/^([a-zA-Z_]\w*)\.stop\(/);
    if (match && driveMotorSides.has(match[1])) return add("motor", `stop ${match[1]}`, `stop:${driveMotorSides.get(match[1])}`);
    match = text.match(/^wait\(\s*([\d.]+)\s*,\s*SECONDS/);
    if (match) return add("control", `wait ${match[1]} seconds`, `wait:${match[1]}`);
    match = text.match(/brain\.screen\.print\((.+)\)/);
    if (match) return add("looks", `print ${match[1]}`, `print:${match[1].replace(/^['\"]|['\"]$/g, "")}`);
    if (/brain\.screen\.clear_screen\(/.test(text)) return add("looks", "clear brain screen", "clear");
    match = text.match(/^([a-zA-Z_]\w*)\.(on|off)\(/);
    if (match && ledNames.has(match[1])) return add("looks", `turn ${match[1]} ${match[2]}`, `led:${match[2] === "on" ? "1" : "0"}`);
    if (/while\s+not\s+bumper_a\.pressing/.test(text)) return add("control", "wait until bumper_a pressed", "waitsensor:bumper");
    if (/while\s+not\s+limit_switch_b\.pressing/.test(text)) return add("control", "wait until limit_switch_b pressed", "waitsensor:limit");
    match = text.match(/^while\s+(.+)\s*:\s*$/);
    if (match) return add("control", `while ${match[1]}`, "while", match[1].trim());
    match = text.match(/^if\s+(.+)\s*:\s*$/);
    if (match) return add("control", `if ${match[1]}`, "if", match[1].trim());
    match = text.match(/^elif\s+(.+)\s*:\s*$/);
    if (match) return add("control", `elif ${match[1]}`, "elif", match[1].trim());
    if (/^else\s*:\s*$/.test(text)) return add("control", "else", "else");
    if (text === "break") return add("control", "break", "break");
    if (text === "pass") return add("control", "pass", "pass");
    if (/bumper_a\.pressing/.test(text)) return add("sensing", "read bumper_a", "read:bumper");
    if (/limit_switch_b\.pressing/.test(text)) return add("sensing", "read limit_switch_b", "read:limit");
    if (/light_c\.brightness/.test(text)) return add("sensing", "read light_c brightness", "read:light");
    if (/line_tracker_d\.reflectivity/.test(text)) return add("sensing", "read line_tracker_d reflectivity", "read:line");
    if (/potentiometer_e\.angle/.test(text)) return add("sensing", "read potentiometer_e angle", "read:pot");
    match = text.match(/drivetrain\.drive_for\((FORWARD|REVERSE),\s*(\d+)/);
    if (match) return add("motor", `drive ${match[1].toLowerCase()} for ${match[2]} mm`, `drive:${match[2]}:${match[1] === "FORWARD" ? "1" : "-1"}`);
    match = text.match(/drivetrain\.turn_for\((RIGHT|LEFT),\s*(\d+)/);
    if (match) return add("motor", `turn ${match[1].toLowerCase()} for ${match[2]} degrees`, `turn:${match[2]}:${match[1] === "RIGHT" ? "1" : "-1"}`);
  });
  return parsed.length ? parsed : [{ id: 999, kind: "event", label: "program start", command: "start", sourceLine: 0 }];
}

function findScopeEnd(program: Block[], index: number) {
  const baseIndent = program[index]?.indent ?? 0;
  let next = index + 1;
  while (next < program.length && (program[next].indent ?? 0) > baseIndent) next += 1;
  return next;
}

function findLoopToRepeat(program: Block[], index: number, exitingLoops: Set<number>) {
  for (let loopIndex = index - 1; loopIndex >= 0; loopIndex -= 1) {
    if (program[loopIndex].command !== "while" || findScopeEnd(program, loopIndex) !== index) continue;
    if (exitingLoops.has(loopIndex)) { exitingLoops.delete(loopIndex); continue; }
    return loopIndex;
  }
  return null;
}

function findEnclosingLoop(program: Block[], index: number) {
  const currentIndent = program[index]?.indent ?? 0;
  for (let loopIndex = index - 1; loopIndex >= 0; loopIndex -= 1) {
    if (program[loopIndex].command === "while" && (program[loopIndex].indent ?? 0) < currentIndent && findScopeEnd(program, loopIndex) > index) return loopIndex;
  }
  return null;
}

function sensorExpressionValue(expression: string, sensors: SensorState, devices: Device[]): boolean | number | null {
  const text = expression.trim();
  if (text === "True") return true;
  if (text === "False") return false;
  const method = text.match(/^([a-zA-Z_]\w*)\.(pressing|brightness|reflectivity|angle)\(\s*(?:PERCENT)?\s*\)$/);
  if (!method) return null;
  const device = devices.find((item) => item.name === method[1]);
  if (!device) return null;
  if (method[2] === "pressing" && device.type === "Bumper") return sensors.bumper;
  if (method[2] === "pressing" && device.type === "Limit Switch") return sensors.limit;
  if (method[2] === "brightness" && device.type === "Light Sensor") return sensors.light;
  if (method[2] === "reflectivity" && device.type === "Line Tracker") return sensors.line;
  if (method[2] === "angle" && device.type === "Potentiometer") return sensors.pot;
  return null;
}

function evaluateSensorCondition(expression: string, sensors: SensorState, devices: Device[]): boolean {
  const text = expression.trim().replace(/^\((.*)\)$/, "$1").trim();
  const orParts = text.split(/\s+or\s+/);
  if (orParts.length > 1) return orParts.some((part) => evaluateSensorCondition(part, sensors, devices));
  const andParts = text.split(/\s+and\s+/);
  if (andParts.length > 1) return andParts.every((part) => evaluateSensorCondition(part, sensors, devices));
  if (text.startsWith("not ")) return !evaluateSensorCondition(text.slice(4), sensors, devices);
  const comparison = text.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?|True|False)$/);
  if (comparison) {
    const left = sensorExpressionValue(comparison[1], sensors, devices);
    const right = comparison[3] === "True" ? true : comparison[3] === "False" ? false : Number(comparison[3]);
    if (left === null) return false;
    if (comparison[2] === "==") return left === right;
    if (comparison[2] === "!=") return left !== right;
    if (comparison[2] === ">=") return Number(left) >= Number(right);
    if (comparison[2] === "<=") return Number(left) <= Number(right);
    if (comparison[2] === ">") return Number(left) > Number(right);
    return Number(left) < Number(right);
  }
  return Boolean(sensorExpressionValue(text, sensors, devices));
}
function activeMotionLoopConditions(program: Block[], motionIndex: number, sensors: SensorState, devices: Device[]) {
  const motionIndent = program[motionIndex]?.indent ?? 0;
  const conditions: string[] = [];
  let insideRepeatingLoop = false;
  for (let controlIndex = motionIndex - 1; controlIndex >= 0; controlIndex -= 1) {
    const control = program[controlIndex];
    if ((control.indent ?? 0) >= motionIndent || findScopeEnd(program, controlIndex) <= motionIndex) continue;
    if (control.command === "else") return null;
    if (control.command !== "while" && control.command !== "if" && control.command !== "elif") continue;
    const condition = control.condition ?? "False";
    if (!evaluateSensorCondition(condition, sensors, devices)) return null;
    conditions.push(condition);
    if (control.command === "while") insideRepeatingLoop = true;
  }
  return insideRepeatingLoop ? conditions : null;
}
function pythonIndentWidth(line: string) {
  return (line.match(/^\s*/)?.[0] ?? "").replace(/\t/g, "    ").length;
}
function pythonIndentErrors(lines: string[]) {
  const errors: Array<{ severity: Severity; title: string; detail: string; line: number }> = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const indent = pythonIndentWidth(line);
    if (indent % 4 !== 0) errors.push({ severity: "error", title: `Line ${index + 1} has uneven indentation`, detail: "Python levels should use four spaces. Use Tab or Shift+Tab until this line lines up with the purple instruction it belongs under.", line: index + 1 });
    const startsStructure = /^(if|elif|else|while|for)\b/.test(trimmed);
    const hasColon = /:\s*(?:#.*)?$/.test(trimmed);
    if (startsStructure && !hasColon) errors.push({ severity: "error", title: `Line ${index + 1} needs a colon`, detail: `Add : to the end of “${trimmed}”.`, line: index + 1 });
    if (!startsStructure || !hasColon) return;
    let bodyIndex = index + 1;
    while (bodyIndex < lines.length && (!lines[bodyIndex].trim() || lines[bodyIndex].trim().startsWith("#"))) bodyIndex += 1;
    if (bodyIndex >= lines.length) {
      errors.push({ severity: "error", title: `Line ${index + 1} needs indented code below it`, detail: "Add a command on the next line and press Tab so it moves four spaces farther right.", line: index + 1 });
      return;
    }
    const bodyIndent = pythonIndentWidth(lines[bodyIndex]);
    if (bodyIndent < indent + 4) errors.push({ severity: "error", title: `Line ${bodyIndex + 1} needs to move right`, detail: `This line belongs inside the purple ${trimmed.split(/\s|:/)[0]} instruction above it. Press Tab until it is four spaces farther right.`, line: bodyIndex + 1 });
  });
  return errors;
}
function unconditionalLedOffWarnings(lines: string[]) {
  const warnings: Array<{ severity: Severity; title: string; detail: string; line: number }> = [];
  lines.forEach((line, ifIndex) => {
    if (!/^\s*if\s+.+:\s*(?:#.*)?$/.test(line)) return;
    const ifIndent = pythonIndentWidth(line); let foundIndentedBody = false;
    for (let index = ifIndex + 1; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const indent = pythonIndentWidth(lines[index]);
      if (indent < ifIndent) break;
      if (indent > ifIndent) { foundIndentedBody = true; continue; }
      if (!foundIndentedBody || /^(elif|else)\b/.test(trimmed)) break;
      if (/^[a-zA-Z_]\w*\.off\(\s*\)\s*$/.test(trimmed)) warnings.push({ severity: "warning", title: `Line ${index + 1} always turns the LED off`, detail: "This line lines up with if, so it runs after the if every time through the loop—even when the condition is true. Add else: at the same level as if, then indent the off command beneath else.", line: index + 1 });
      break;
    }
  });
  return warnings;
}
function competingMotorBranchWarnings(lines: string[]) {
  const warnings: Array<{ severity: Severity; title: string; detail: string; line: number }> = [];
  lines.forEach((line, ifIndex) => {
    const trimmed = line.trim();
    if (!/^if\s+.+:\s*(?:#.*)?$/.test(trimmed)) return;
    const ifIndent = pythonIndentWidth(line);
    let previousIf = -1;
    for (let index = ifIndex - 1; index >= 0; index -= 1) {
      if (!lines[index].trim() || lines[index].trim().startsWith("#")) continue;
      const indent = pythonIndentWidth(lines[index]);
      if (indent < ifIndent) break;
      if (indent === ifIndent && /^if\s+.+:/.test(lines[index].trim())) { previousIf = index; break; }
    }
    if (previousIf < 0 || !lines.slice(previousIf + 1, ifIndex).some((item) => /\.spin\(/.test(item))) return;
    let elseIndex = -1;
    for (let index = ifIndex + 1; index < lines.length; index += 1) {
      if (!lines[index].trim() || lines[index].trim().startsWith("#")) continue;
      const indent = pythonIndentWidth(lines[index]);
      if (indent < ifIndent) break;
      if (indent !== ifIndent) continue;
      if (/^else\s*:/.test(lines[index].trim())) { elseIndex = index; break; }
      if (!/^elif\s+.+:/.test(lines[index].trim())) break;
    }
    if (elseIndex < 0) return;
    for (let index = elseIndex + 1; index < lines.length; index += 1) {
      if (!lines[index].trim() || lines[index].trim().startsWith("#")) continue;
      if (pythonIndentWidth(lines[index]) <= ifIndent) break;
      if (!/\.stop\(/.test(lines[index])) continue;
      warnings.push({ severity: "warning", title: `Line ${index + 1} overrides the earlier motor command`, detail: "This is a second, separate if statement. When its condition is false, this else runs and stops the motors—even if the earlier if started them. Use elif for the second condition and one final else when only one motor action should happen each loop.", line: index + 1 });
      break;
    }
  });
  return warnings;
}
function friendlyPythonChecks(code: string, devices: Device[]) {
  const messages: Array<{ severity: Severity; title: string; detail: string; line?: number }> = [];
  const lines = code.split("\n"); const configured = new Set([...devices.map((d) => d.name), "drivetrain"]);
  messages.push(...pythonIndentErrors(lines), ...unconditionalLedOffWarnings(lines), ...competingMotorBranchWarnings(lines));
  lines.forEach((line, index) => {
    const velocity = line.match(/set_(?:drive_|turn_)?velocity\s*\(\s*(-?[\d.]+)\s*,\s*(PERCENT|RPM)/);
    if (velocity && (Number(velocity[1]) < 0 || (velocity[2] === "PERCENT" && Number(velocity[1]) > 100))) messages.push({ severity: "error", title: `Line ${index + 1} has an impossible speed`, detail: velocity[2] === "PERCENT" ? "Motor velocity must be from 0% through 100%." : "Motor velocity cannot be negative.", line: index + 1 });
    const deviceUse = line.match(/\b([a-z][a-z0-9_]+)\.(?:spin|stop|set_velocity|set_drive_velocity|set_turn_velocity|pressing|brightness|reflectivity|angle|on|off)\b/);
    if (deviceUse && !configured.has(deviceUse[1])) messages.push({ severity: "error", title: `I don’t recognize “${deviceUse[1]}”`, detail: "Use a device name from Robot Setup, or choose Use PLTW Testbed Setup.", line: index + 1 });
  });
  if (/^\s*if\s+.+\.pressing\(\)\s*:/m.test(code)) messages.push({ severity: "tip", title: "An if checks the sensor once", detail: "Latch the switch in Simulator before Run. To pause until it is pressed, use: while not sensor.pressing():" });
  if (/\.spin\(/.test(code) && !/\.stop\(/.test(code)) messages.push({ severity: "warning", title: "Your motors may keep running", detail: "Add a motor stop command when the motion should end." });
  if (/while\s+True\s*:/.test(code)) {
    const foreverLine = lines.findIndex((line) => /while\s+True\s*:/.test(line));
    if (lines.slice(foreverLine + 1).some((line) => line.trim() && !/^\s/.test(line))) messages.push({ severity: "warning", title: "Code after while True cannot run", detail: "while True never becomes false. The if inside it is checked again and again, but code below the loop needs a break before it can run." });
  }
  if (!messages.length) messages.push({ severity: "tip", title: "Ready to test", detail: "No common problems found. Run or step through the program." });
  return messages;
}
function friendlyBlockChecks(blocks: Block[], devices: Device[]) {
  const messages: Array<{ severity: Severity; title: string; detail: string }> = [];
  const commands = blocks.map((block) => block.command);
  if (commands.some((command) => command.startsWith("spin:")) && !commands.some((command) => command.startsWith("stop:"))) messages.push({ severity: "warning", title: "Your motors may keep running", detail: "Add a stop motor block where the motion should end." });
  const configured = new Set(devices.map((device) => device.name));
  if (commands.includes("waitsensor:bumper") && !configured.has("bumper_a")) messages.push({ severity: "error", title: "The bumper is missing", detail: "Choose Use PLTW Testbed Setup before waiting for bumper_a." });
  if (commands.includes("waitsensor:limit") && !configured.has("limit_switch_b")) messages.push({ severity: "error", title: "The limit switch is missing", detail: "Choose Use PLTW Testbed Setup before waiting for limit_switch_b." });
  if (!messages.length) messages.push({ severity: "tip", title: "Your blocks are ready", detail: "Use Step to watch one block at a time, or Run to test the whole program." });
  return messages;
}
function endsWithStop(program: Block[], side: "left" | "right") {
  let lastDirection: number | null = null;
  for (const block of program) {
    const [action, target, direction] = block.command.split(":");
    if (action === "spin" && target === side) lastDirection = Number(direction);
    if (action === "stop" && (target === side || target === "both")) lastDirection = 0;
  }
  return lastDirection === 0;
}

export default function Home() {
  const [view, setView] = useState<View>("program"); const [mode, setMode] = useState<Mode>("blocks");
  const [projectName, setProjectName] = useState("Classroom Motor Test"); const [devices, setDevices] = useState<Device[]>(EXPECTED_DEVICES);
  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS); const [python, setPython] = useState(STARTER_PYTHON);
  const [activeCategory, setActiveCategory] = useState("Motion"); const [selectedBlock, setSelectedBlock] = useState<number | null>(null); const [selectedSetupPort, setSelectedSetupPort] = useState("A");
  const [runState, setRunState] = useState<RunState>("ready"); const [runIndex, setRunIndex] = useState(0); const [speed, setSpeed] = useState(1);
  const [lastAction, setLastAction] = useState("Ready to run"); const [consoleLines, setConsoleLines] = useState<string[]>(["Simulator ready."]); const [brainText, setBrainText] = useState("V5 Classroom\nReady");
  const [leftVelocity, setLeftVelocity] = useState(40); const [rightVelocity, setRightVelocity] = useState(40); const [leftDirection, setLeftDirection] = useState(0); const [rightDirection, setRightDirection] = useState(0);
  const [robot, setRobot] = useState(DEFAULT_ROBOT); const [sensors, setSensors] = useState<SensorState>({ bumper: false, limit: false, light: 65, line: 82, pot: 35, led: false });
  const [playgroundId, setPlaygroundId] = useState<PlaygroundId>("open"); const [collision, setCollision] = useState(false);
  const [worldObjects, setWorldObjects] = useState<PlaygroundObstacle[]>(() => clonePlaygroundObjects(PLAYGROUNDS[0])); const [debris, setDebris] = useState<PlaygroundDebris[]>([]); const [deliveredIds, setDeliveredIds] = useState<string[]>([]);
  const [waitUntil, setWaitUntil] = useState<number | null>(null); const [pendingMotion, setPendingMotion] = useState<"drive" | "turn" | null>(null); const [history, setHistory] = useState<Block[][]>([INITIAL_BLOCKS]); const [historyIndex, setHistoryIndex] = useState(0);
  const [pythonHistory, setPythonHistory] = useState([STARTER_PYTHON]); const [pythonHistoryIndex, setPythonHistoryIndex] = useState(0); const [lastWorking, setLastWorking] = useState({ blocks: INITIAL_BLOCKS, python: STARTER_PYTHON });
  const [notice, setNotice] = useState("Autosaved"); const [drawerOpen, setDrawerOpen] = useState(true); const [showChecks, setShowChecks] = useState(true);
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [selectedPythonEntry, setSelectedPythonEntry] = useState<ToolboxEntry | null>(null); const [pythonOptionValues, setPythonOptionValues] = useState<Record<string, string>>({}); const [pythonCursor, setPythonCursor] = useState({ line: 1, column: 1 });
  const nextId = useRef(20); const pythonTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const executeStepRef = useRef<(indexOverride?: number) => void>(() => {}); const branchTakenRef = useRef<Record<number, boolean>>({}); const exitingLoopsRef = useRef<Set<number>>(new Set());
  const loopMotionCarryRef = useRef<{ motion: "drive" | "turn"; conditions: string[] } | null>(null);
  const robotRef = useRef(DEFAULT_ROBOT); const collisionLockRef = useRef(false);
  const pythonEditorRef = useRef<HTMLTextAreaElement | null>(null); const pythonHighlightRef = useRef<HTMLPreElement | null>(null); const pythonLineRailRef = useRef<HTMLDivElement | null>(null); const pythonSelectionRef = useRef({ start: STARTER_PYTHON.length, end: STARTER_PYTHON.length });
  const testbedStatus = useMemo(() => EXPECTED_DEVICES.map((expected) => { const actual = devices.find((d) => d.port === expected.port); return { expected, actual, ok: actual?.name === expected.name && actual?.type === expected.type }; }), [devices]);
  const selectedSetupDevice = devices.find((device) => device.port === selectedSetupPort);
  const selectedSetupPortIsSmart = /^\d+$/.test(selectedSetupPort);
  const selectedSetupDeviceTypes = selectedSetupPortIsSmart ? SMART_DEVICE_TYPES : THREE_WIRE_DEVICE_TYPES;
  const motionGroups = useMemo(() => buildMotionGroups(devices), [devices]);
  const threeWireGroups = useMemo(() => buildThreeWireGroups(devices, mode), [devices, mode]);
  const TOOLBOX = useMemo(() => ({ ...BASE_TOOLBOX, "3-Wire": { ...BASE_TOOLBOX["3-Wire"], entries: threeWireGroups.flatMap((group) => group.entries) } }), [threeWireGroups]);
  const testbedOkay = testbedStatus.every((item) => item.ok); const pythonMessages = useMemo(() => friendlyPythonChecks(python, devices), [python, devices]); const blockMessages = useMemo(() => friendlyBlockChecks(blocks, devices), [blocks, devices]);
  const parsedPython = useMemo(() => pythonToBlocks(python, devices), [python, devices]);
  const activeProgram = mode === "blocks" ? blocks : parsedPython;
  const leftDriveDevice = devices.find((device) => device.type === "Smart Motor" && device.role === "Left drive");
  const rightDriveDevice = devices.find((device) => device.type === "Smart Motor" && device.role === "Right drive");
  const selectedPythonTemplate = selectedPythonEntry ? getPythonOptionTemplate(selectedPythonEntry, devices) : null;
  const selectedPythonPreview = selectedPythonTemplate ? selectedPythonTemplate.build(pythonOptionValues) : "";
  const currentPlayground = PLAYGROUNDS.find((playground) => playground.id === playgroundId) ?? PLAYGROUNDS[0];
  const setBlocksWithHistory = useCallback((next: Block[]) => { setBlocks(next); setHistory((old) => [...old.slice(0, historyIndex + 1), next]); setHistoryIndex((index) => index + 1); }, [historyIndex]);

  function setSetupPortType(port: string, type: string) {
    setDevices((items) => {
      const withoutPort = items.filter((item) => item.port !== port);
      if (!type) return withoutPort;
      const existing = items.find((item) => item.port === port);
      const name = existing?.type === type ? existing.name : defaultDeviceName(type, port);
      return [...withoutPort, { port, type, name, expected: name, role: type === "Smart Motor" ? existing?.role || "Mechanism" : undefined }].sort((first, second) => {
        const firstNumber = Number(first.port); const secondNumber = Number(second.port);
        if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) return firstNumber - secondNumber;
        if (Number.isFinite(firstNumber)) return -1;
        if (Number.isFinite(secondNumber)) return 1;
        return first.port.localeCompare(second.port);
      });
    });
  }
  function updateSetupDevice(port: string, changes: Partial<Device>) {
    setDevices((items) => items.map((item) => item.port === port ? { ...item, ...changes, expected: changes.name ?? item.expected } : item));
  }
  function usePLTWTestbed() {
    setDevices(EXPECTED_DEVICES); setSelectedSetupPort("A"); setNotice("PLTW Testbed setup loaded");
  }

  useEffect(() => { const timer = setTimeout(() => { const saved = localStorage.getItem("v5-classroom-project-v9"); if (saved) try { const data = JSON.parse(saved); if (data.blocks) setBlocks(data.blocks); if (data.python) setPython(data.python); if (data.devices) setDevices(data.devices); if (data.projectName) setProjectName(data.projectName); setNotice("Recovered your last project"); } catch {} const recent = localStorage.getItem("v5-classroom-recent-v9"); if (recent) try { setRecentProjects(JSON.parse(recent)); } catch {} }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { const timer = setTimeout(() => { localStorage.setItem("v5-classroom-project-v9", JSON.stringify({ projectName, devices, blocks, python })); setNotice(`Autosaved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`); }, 450); return () => clearTimeout(timer); }, [projectName, devices, blocks, python]);
  useEffect(() => { if (runState !== "running") return; const timer = setTimeout(() => executeStepRef.current(), Math.max(MIN_STEP_DELAY_MS, STEP_DELAY_MS / speed)); return () => clearTimeout(timer); }, [runState, runIndex, speed, activeProgram]);
  useEffect(() => { if (runState !== "waiting" || waitUntil === null) return; const timer = setTimeout(() => { setWaitUntil(null); if (pendingMotion) { const loopConditions = activeMotionLoopConditions(activeProgram, runIndex, sensors, devices); if (loopConditions) { loopMotionCarryRef.current = { motion: pendingMotion, conditions: loopConditions }; setLastAction(`${pendingMotion === "drive" ? "Drive" : "Turn"} segment complete — loop continuing`); } else { loopMotionCarryRef.current = null; setLeftDirection(0); setRightDirection(0); setLastAction(`${pendingMotion === "drive" ? "Drive" : "Turn"} completed`); setConsoleLines((lines) => [...lines.slice(-7), `■ ${pendingMotion === "drive" ? "Drive distance" : "Turn angle"} completed — motors stopped.`]); } setPendingMotion(null); } setRunState("running"); setRunIndex((index) => index + 1); }, Math.max(0, waitUntil - Date.now())); return () => clearTimeout(timer); }, [runState, waitUntil, pendingMotion, activeProgram, runIndex, sensors, devices]);
  useEffect(() => { if (runState !== "waiting") return; const command = activeProgram[runIndex]?.command; const bumperReady = command === "waitsensor:bumper" && sensors.bumper; const limitReady = command === "waitsensor:limit" && sensors.limit; if (!bumperReady && !limitReady) return; const timer = setTimeout(() => { setRunState("running"); setRunIndex(findScopeEnd(activeProgram, runIndex)); setLastAction(`${bumperReady ? "Bumper" : "Limit switch"} pressed — continuing`); }, 0); return () => clearTimeout(timer); }, [sensors.bumper, sensors.limit, runState, activeProgram, runIndex]);
  useEffect(() => { if (runState !== "finished") return; const timer = setTimeout(() => { if (endsWithStop(activeProgram, "left")) setLeftDirection(0); if (endsWithStop(activeProgram, "right")) setRightDirection(0); }, 0); return () => clearTimeout(timer); }, [runState, activeProgram]);
  useEffect(() => { robotRef.current = robot; }, [robot]);
  useEffect(() => {
    if (!leftDirection && !rightDirection) return;
    const timer = setInterval(() => {
      const old = robotRef.current;
      const left = leftDirection * leftVelocity / 100; const right = rightDirection * rightVelocity / 100;
      const heading = old.heading + (right - left) * 2.8; const travel = (left + right) * 0.38; const radians = heading * Math.PI / 180;
      const next = { x: Math.max(5, Math.min(95, old.x + Math.cos(radians) * travel)), y: Math.max(9, Math.min(91, old.y + Math.sin(radians) * travel)), heading };
      const obstacle = findRobotObstacle(worldObjects, next.x, next.y);
      if (obstacle?.behavior === "pushable" && Math.abs(travel) > 0.01) {
        const pushDistance = Math.max(0.55, Math.abs(travel) * 1.35);
        const candidate = { ...obstacle, x: obstacle.x + Math.cos(radians) * pushDistance, y: obstacle.y + Math.sin(radians) * pushDistance };
        if (canMovePlaygroundObject(candidate, worldObjects)) {
          const delivered = objectReachedGoal(candidate);
          setWorldObjects((objects) => objects.map((item) => item.id === candidate.id ? candidate : item));
          if (delivered && !deliveredIds.includes(candidate.id)) {
            setDeliveredIds((ids) => [...ids, candidate.id]);
            setConsoleLines((lines) => [...lines.slice(-7), `✓ ${candidate.label} reached ${candidate.goal?.label ?? "its target"}.`]);
            setLastAction(`${candidate.label} delivered`);
          } else {
            if (!delivered && deliveredIds.includes(candidate.id)) setDeliveredIds((ids) => ids.filter((id) => id !== candidate.id));
            setLastAction(`Pushing ${candidate.label}`);
          }
          collisionLockRef.current = false; setCollision(false); robotRef.current = next; setRobot(next);
          return;
        }
      }
      if (obstacle?.behavior === "breakable" && Math.abs(travel) > 0.01) {
        setWorldObjects((objects) => objects.filter((item) => item.id !== obstacle.id));
        setDebris((pieces) => pieces.some((piece) => piece.id === obstacle.id) ? pieces : [...pieces, { id: obstacle.id, x: obstacle.x, y: obstacle.y + obstacle.height * 0.55, width: obstacle.width, height: obstacle.height * 0.45 }]);
        setConsoleLines((lines) => [...lines.slice(-7), `💥 ${obstacle.label} was knocked down. The code keeps running.`]);
        setLastAction(`${obstacle.label} destroyed — code keeps running`);
        collisionLockRef.current = false; setCollision(false); robotRef.current = next; setRobot(next);
        return;
      }
      if (obstacle) {
        if (!collisionLockRef.current) {
          setConsoleLines((lines) => [...lines.slice(-7), `⚠ ${obstacle.label} is blocking movement. Collision did not stop the code or motors.`]);
          setLastAction(`${obstacle.label} blocked movement — code keeps running`);
        }
        collisionLockRef.current = true; setCollision(true);
        const blockedPose = { ...old, heading }; robotRef.current = blockedPose; setRobot(blockedPose);
        return;
      }
      if (collisionLockRef.current) setCollision(false);
      collisionLockRef.current = false; robotRef.current = next; setRobot(next);
    }, 55);
    return () => clearInterval(timer);
  }, [leftDirection, rightDirection, leftVelocity, rightVelocity, currentPlayground, worldObjects, deliveredIds]);
  const log = (message: string) => setConsoleLines((lines) => [...lines.slice(-7), message]);

  function executeStep(indexOverride?: number) {
    const currentIndex = indexOverride ?? runIndex;
    const loopToRepeat = findLoopToRepeat(activeProgram, currentIndex, exitingLoopsRef.current);
    if (loopToRepeat !== null) { setRunIndex(loopToRepeat); setLastAction("Repeating while loop"); return; }
    if (currentIndex >= activeProgram.length) { if (endsWithStop(activeProgram, "left")) setLeftDirection(0); if (endsWithStop(activeProgram, "right")) setRightDirection(0); setRunState("finished"); setLastAction("Program finished"); log("✓ Program finished."); setLastWorking({ blocks, python }); return; }
    const block = activeProgram[currentIndex]; const [action, a, b] = block.command.split(":"); const sourceNote = block.sourceLine !== undefined ? `Line ${block.sourceLine + 1}: ` : ""; setLastAction(block.label); log(`→ ${sourceNote}${block.label}`);
    if (action === "while") {
      const result = evaluateSensorCondition(block.condition ?? "False", sensors, devices);
      if (!result && loopMotionCarryRef.current?.conditions.includes(block.condition ?? "False")) { loopMotionCarryRef.current = null; setLeftDirection(0); setRightDirection(0); log(`■ ${block.condition} became false — continuous loop motion stopped.`); }
      log(`↻ ${block.condition} is ${result ? "TRUE — repeating loop" : "FALSE — leaving loop"}.`);
      if (!result) exitingLoopsRef.current.add(currentIndex);
      setLastAction(`${block.condition} → ${result ? "looping" : "finished"}`);
      setRunIndex(result ? currentIndex + 1 : findScopeEnd(activeProgram, currentIndex));
      return;
    }
    if (action === "if" || action === "elif") {
      const branchLevel = block.indent ?? 0;
      if (action === "elif" && branchTakenRef.current[branchLevel]) { setRunIndex(findScopeEnd(activeProgram, currentIndex)); return; }
      const result = evaluateSensorCondition(block.condition ?? "False", sensors, devices);
      if (!result && loopMotionCarryRef.current?.conditions.includes(block.condition ?? "False")) { loopMotionCarryRef.current = null; setLeftDirection(0); setRightDirection(0); log(`■ ${block.condition} became false — continuous loop motion stopped.`); }
      branchTakenRef.current[branchLevel] = action === "if" ? result : Boolean(branchTakenRef.current[branchLevel]) || result;
      log(`? ${block.condition} is ${result ? "TRUE — running indented code" : "FALSE — skipping indented code"}.`);
      setLastAction(`${block.condition} → ${result ? "true" : "false"}`);
      setRunIndex(result ? currentIndex + 1 : findScopeEnd(activeProgram, currentIndex));
      return;
    }
    if (action === "else") {
      const branchLevel = block.indent ?? 0;
      const alreadyRan = Boolean(branchTakenRef.current[branchLevel]);
      branchTakenRef.current[branchLevel] = true;
      setRunIndex(alreadyRan ? findScopeEnd(activeProgram, currentIndex) : currentIndex + 1);
      return;
    }
    if (action === "break") {
      const loopIndex = findEnclosingLoop(activeProgram, currentIndex);
      if (loopIndex !== null) { exitingLoopsRef.current.add(loopIndex); setRunIndex(findScopeEnd(activeProgram, loopIndex)); setLastAction("Break — leaving loop"); return; }
    }
    if (action === "velocity") {
      if (a === "left" || a === "both") setLeftVelocity(Number(b));
      if (a === "right" || a === "both") setRightVelocity(Number(b));
      if (a === "both") { setLastAction(`All drivetrain motors set to ${b}%`); log(`⚙ Drivetrain group velocity set to ${b}% on both sides.`); }
    }
    if (action === "spin") {
      const nextCommand = activeProgram[currentIndex + 1]?.command;
      const [nextAction, nextSide, nextDirection] = nextCommand?.split(":") ?? [];
      const pairedDriveSpin = nextAction === "spin" && ((a === "left" && nextSide === "right") || (a === "right" && nextSide === "left"));
      if (a === "left") setLeftDirection(Number(b)); else setRightDirection(Number(b));
      if (pairedDriveSpin) {
        if (nextSide === "left") setLeftDirection(Number(nextDirection)); else setRightDirection(Number(nextDirection));
        setLastAction("start left_motor and right_motor together");
        log("▶ Both drive motors started together.");
        setRunIndex(currentIndex + 2);
        return;
      }
    }
    if (action === "stop") {
      const nextCommand = activeProgram[currentIndex + 1]?.command;
      const pairedDriveStop = (a === "left" && nextCommand === "stop:right") || (a === "right" && nextCommand === "stop:left");
      if (a === "left" || a === "both" || pairedDriveStop) setLeftDirection(0);
      if (a === "right" || a === "both" || pairedDriveStop) setRightDirection(0);
      if (pairedDriveStop) { setLastAction("stop left_motor and right_motor"); log(`■ Both drive motors stopped${block.sourceLine !== undefined ? ` on line ${block.sourceLine + 1}` : ""}.`); setRunIndex(currentIndex + 2); return; }
    }
    if (action === "print") { setBrainText(a); log(`Brain: ${a}`); } if (action === "clear") setBrainText(""); if (action === "led") setSensors((old) => ({ ...old, led: a === "1" }));
    if (action === "read") { const values: Record<string, string | number | boolean> = { bumper: sensors.bumper, limit: sensors.limit, light: sensors.light, line: sensors.line, pot: sensors.pot }; setBrainText(String(values[a])); }
    if (action === "drive") { const direction = Number(b || "1"); setLeftDirection(direction); setRightDirection(direction); setPendingMotion("drive"); setWaitUntil(Date.now() + Math.max(250, Number(a) * 4)); setRunState("waiting"); return; }
    if (action === "turn") { const direction = Number(b || "1"); setLeftDirection(direction); setRightDirection(-direction); setPendingMotion("turn"); setWaitUntil(Date.now() + Math.max(250, Number(a) * 9)); setRunState("waiting"); return; }
    if (action === "wait") { setWaitUntil(Date.now() + Number(a) * 1000); setRunState("waiting"); return; }
    if (action === "waitsensor") { const pressed = a === "bumper" ? sensors.bumper : sensors.limit; if (!pressed) { setRunState("waiting"); setLastAction(`Waiting for ${a} — try it in Simulator`); return; } setRunIndex(findScopeEnd(activeProgram, currentIndex)); return; }
    setRunIndex(currentIndex + 1);
  }
  useEffect(() => { executeStepRef.current = executeStep; });
  function startRun() { if (mode === "python" && pythonMessages.some((m) => m.severity === "error")) { setNotice("Fix the highlighted Python problem first"); setShowChecks(true); return; } branchTakenRef.current = {}; exitingLoopsRef.current.clear(); loopMotionCarryRef.current = null; collisionLockRef.current = false; setCollision(false); setPendingMotion(null); setRunIndex(0); setRunState("running"); setConsoleLines([`Running ${mode === "blocks" ? "Blocks" : "Python"} project on ${currentPlayground.name}…`]); setView("program"); setLastAction("Starting program"); }
  function pauseRun() { setRunState((state) => state === "paused" ? "running" : "paused"); }
  function stopRun() { exitingLoopsRef.current.clear(); loopMotionCarryRef.current = null; collisionLockRef.current = false; setCollision(false); setRunState("ready"); setRunIndex(0); setLeftDirection(0); setRightDirection(0); setWaitUntil(null); setPendingMotion(null); setLastAction("Stopped"); log("■ Program stopped."); }
  function resetRobot() { exitingLoopsRef.current.clear(); loopMotionCarryRef.current = null; collisionLockRef.current = false; setCollision(false); setRunState("ready"); setRunIndex(0); setLeftDirection(0); setRightDirection(0); setWaitUntil(null); setPendingMotion(null); robotRef.current = currentPlayground.start; setRobot(currentPlayground.start); setLastAction(`Robot reset on ${currentPlayground.name}`); log("↻ Robot position reset."); }
  function resetPlayground() { resetRobot(); setWorldObjects(clonePlaygroundObjects(currentPlayground)); setDebris([]); setDeliveredIds([]); setLastAction(`${currentPlayground.name} reset`); setConsoleLines([`↻ ${currentPlayground.name} reset. Crates and structures are back in place.`]); }
  function changePlayground(nextId: PlaygroundId) {
    const nextPlayground = PLAYGROUNDS.find((playground) => playground.id === nextId) ?? PLAYGROUNDS[0];
    exitingLoopsRef.current.clear(); collisionLockRef.current = false; setCollision(false); setPlaygroundId(nextPlayground.id); setWorldObjects(clonePlaygroundObjects(nextPlayground)); setDebris([]); setDeliveredIds([]); setRunState("ready"); setRunIndex(0); setLeftDirection(0); setRightDirection(0); setWaitUntil(null); setPendingMotion(null); robotRef.current = nextPlayground.start; setRobot(nextPlayground.start); setLastAction(`${nextPlayground.name} loaded`); setConsoleLines([`Playground loaded: ${nextPlayground.name}. ${nextPlayground.description}`]);
  }
  function stepRun() { const startAt = runState === "ready" || runState === "finished" ? 0 : runIndex; if (startAt === 0) setRunIndex(0); setRunState("paused"); executeStep(startAt); }
  function rememberPythonSelection(editor: HTMLTextAreaElement) {
    pythonSelectionRef.current = { start: editor.selectionStart, end: editor.selectionEnd };
    const before = editor.value.slice(0, editor.selectionStart); const lines = before.split("\n");
    setPythonCursor({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  }
  function handlePythonKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const editor = event.currentTarget;
    const changed = changePythonIndent(editor.value, editor.selectionStart, editor.selectionEnd, event.shiftKey);
    setPython(changed.value); queuePythonHistory(changed.value); pythonSelectionRef.current = { start: changed.selectionStart, end: changed.selectionEnd };
    requestAnimationFrame(() => { const currentEditor = pythonEditorRef.current; if (!currentEditor) return; currentEditor.focus(); currentEditor.setSelectionRange(changed.selectionStart, changed.selectionEnd); rememberPythonSelection(currentEditor); });
  }
  function syncPythonScroll(editor: HTMLTextAreaElement) { if (pythonHighlightRef.current) { pythonHighlightRef.current.scrollTop = editor.scrollTop; pythonHighlightRef.current.scrollLeft = editor.scrollLeft; } if (pythonLineRailRef.current) pythonLineRailRef.current.scrollTop = editor.scrollTop; }
  function insertPythonCode(code: string) {
    const editor = pythonEditorRef.current; const selection = editor ? { start: editor.selectionStart, end: editor.selectionEnd } : pythonSelectionRef.current;
    const inserted = insertPythonSnippet(python, code, selection.start, selection.end);
    setPython(inserted.value); queuePythonHistory(inserted.value); pythonSelectionRef.current = { start: inserted.caret, end: inserted.caret };
    requestAnimationFrame(() => { const currentEditor = pythonEditorRef.current; if (!currentEditor) return; currentEditor.focus(); currentEditor.setSelectionRange(inserted.caret, inserted.caret); rememberPythonSelection(currentEditor); });
  }
  function openPythonOptions(entry: ToolboxEntry) {
    const template = getPythonOptionTemplate(entry, devices); if (!template) { insertPythonCode(entry.python); return; }
    setSelectedPythonEntry(entry); setPythonOptionValues(Object.fromEntries(template.fields.map((field) => [field.key, field.defaultValue])));
  }
  function addToolboxEntry(entry: { label: string; command: string; kind: Block["kind"]; python: string }) {
    if (mode === "blocks") { setBlocksWithHistory([...blocks, { id: nextId.current++, label: entry.label, command: entry.command, kind: entry.kind }]); return; }
    insertPythonCode(entry.python);
  }
  function queuePythonHistory(value: string) { if (pythonTimer.current) clearTimeout(pythonTimer.current); pythonTimer.current = setTimeout(() => { setPythonHistory((old) => [...old.slice(0, pythonHistoryIndex + 1), value]); setPythonHistoryIndex((index) => index + 1); }, 500); }
  function undo() { if (mode === "blocks" && historyIndex > 0) { setHistoryIndex(historyIndex - 1); setBlocks(history[historyIndex - 1]); } if (mode === "python" && pythonHistoryIndex > 0) { setPythonHistoryIndex(pythonHistoryIndex - 1); setPython(pythonHistory[pythonHistoryIndex - 1]); } }
  function redo() { if (mode === "blocks" && historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setBlocks(history[historyIndex + 1]); } if (mode === "python" && pythonHistoryIndex < pythonHistory.length - 1) { setPythonHistoryIndex(pythonHistoryIndex + 1); setPython(pythonHistory[pythonHistoryIndex + 1]); } }
  function restoreWorking() { if (!confirm("Replace the current workspace with the last program that ran successfully?")) return; setBlocksWithHistory(lastWorking.blocks); setPython(lastWorking.python); setNotice("Last working version restored"); }
  function resetWorkspace() { if (!confirm(`Reset only the ${mode === "blocks" ? "Blocks" : "Python"} workspace to its starter program?`)) return; if (mode === "blocks") setBlocksWithHistory(INITIAL_BLOCKS); else { setPython(STARTER_PYTHON); queuePythonHistory(STARTER_PYTHON); } setNotice(`${mode === "blocks" ? "Blocks" : "Python"} starter restored`); }
  function newProject() { if (!confirm("Start a new project? Your current project is autosaved and can still be recovered.")) return; setBlocksWithHistory([{ id: nextId.current++, kind: "event", label: "when started", command: "start" }]); setPython("from vex import *\n\nbrain = Brain()\n"); setProjectName("Untitled Project"); stopRun(); }
  function rememberProject(item: SavedProject) { const next = [item, ...recentProjects.filter((recent) => recent.name !== item.name)].slice(0, 5); setRecentProjects(next); localStorage.setItem("v5-classroom-recent-v9", JSON.stringify(next)); }
  function loadRecent(index: number) { const item = recentProjects[index]; if (!item) return; setProjectName(item.name); setDevices(item.devices); setBlocks(item.blocks); setPython(item.python); setNotice(`Opened ${item.name}`); }
  function exportProject() { const item = { name: projectName, savedAt: new Date().toISOString(), devices, blocks, python }; rememberProject(item); const blob = new Blob([JSON.stringify({ version: 9, projectName, devices, blocks, python }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.v5classroom.json`; link.click(); URL.revokeObjectURL(url); }
  function importProject(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; file.text().then((text) => { const data = JSON.parse(text); setProjectName(data.projectName); setBlocks(data.blocks); setPython(data.python); setDevices(data.devices); rememberProject({ name: data.projectName, savedAt: new Date().toISOString(), blocks: data.blocks, python: data.python, devices: data.devices }); setNotice("Project opened"); }).catch(() => setNotice("That project file could not be opened")); event.target.value = ""; }
  const blockPython = useMemo(() => `from vex import *\n\nbrain = Brain()\nleft_motor = Motor(Ports.PORT1, GearSetting.RATIO_18_1, False)\nright_motor = Motor(Ports.PORT10, GearSetting.RATIO_18_1, False)\nbumper_a = Bumper(brain.three_wire_port.a)\nlimit_switch_b = Limit(brain.three_wire_port.b)\nlight_c = Light(brain.three_wire_port.c)\nline_tracker_d = Line(brain.three_wire_port.d)\npotentiometer_e = Pot(brain.three_wire_port.e)\nled_f = Led(brain.three_wire_port.f)\n\n${blocks.map(blockToPython).join("\n")}`, [blocks]);
  const pythonDrawerGroups = activeCategory === "Motion" ? motionGroups : [{ entries: TOOLBOX[activeCategory].entries }];
  const renderPythonCommand = (entry: ToolboxEntry, key: string) => <div className="python-command-row" key={key}><button className="python-command" onClick={() => addToolboxEntry(entry)} title="Insert at cursor"><code><PythonSyntax code={entry.displayPython ?? entry.python} /></code><small>＋ insert at cursor</small></button>{getPythonOptionTemplate(entry, devices) && <button className="python-command-options" aria-label={`Change options for ${entry.label}`} title="Change command options" onClick={() => openPythonOptions(entry)}>⚙</button>}</div>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">V5</div><div className="brand-copy"><strong>Classroom Programmer</strong><span>Learn • Test • Build</span></div><div className="file-actions"><button onClick={newProject}>＋ New</button><button onClick={exportProject}>⇩ Save file</button><label className="button-like">⇧ Open<input type="file" accept=".json" onChange={importProject} /></label>{recentProjects.length > 0 && <select className="recent-select" aria-label="Recent projects" defaultValue="" onChange={(event) => { if (event.target.value) loadRecent(Number(event.target.value)); event.target.value = ""; }}><option value="">Recent…</option>{recentProjects.map((recent, index) => <option value={index} key={`${recent.name}-${recent.savedAt}`}>{recent.name}</option>)}</select>}</div><input className="project-name" aria-label="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} /><span className="save-status"><i />{notice}</span></header>
    <nav className="main-tabs" aria-label="Main sections">{[["setup", "1", "Robot Setup"], ["program", "2", "Program + Simulator"], ["code", "</>", "Code View"], ["guide", "?", "Student Guide"]].map(([id, icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id as View)}><span>{icon}</span>{label}</button>)}<div className={classNames("brain-status", devices.length > 0 && "connected")}><i /> {testbedOkay ? "PLTW Testbed Ready" : `Custom Setup • ${devices.length} device${devices.length === 1 ? "" : "s"}`}</div></nav>

    {view === "program" && <section className="combined-view"><section className="program-view">
      <aside className={classNames("toolbox-panel", mode === "python" && "python-toolbox")}>
        <div className="toolbox-title"><strong>Toolbox</strong><button onClick={() => setDrawerOpen(!drawerOpen)}>{drawerOpen ? "‹" : "›"}</button></div>
        {drawerOpen && <>
          <div className="category-list">{Object.entries(TOOLBOX).map(([name, category]) => <button key={name} className={activeCategory === name ? "selected" : ""} onClick={() => { setActiveCategory(name); setSelectedPythonEntry(null); }}><i style={{ background: category.color }} />{name}<span>›</span></button>)}</div>
          <div className="drawer-items">
            <div className="drawer-heading" style={{ background: mode === "blocks" ? TOOLBOX[activeCategory].color : undefined }}>{activeCategory}{mode === "python" && <small>Python commands</small>}</div>
            {mode === "blocks" ? TOOLBOX[activeCategory].entries.map((entry, index) => <button className="mini-block" style={{ background: TOOLBOX[activeCategory].color }} key={`${entry.label}-${index}`} onClick={() => addToolboxEntry(entry)}>{entry.label}<small>＋ click to add</small></button>) : pythonDrawerGroups.map((group, groupIndex) => <section className="drawer-command-group" key={group.heading ?? `commands-${groupIndex}`}>{group.heading && <h3>{group.heading}</h3>}{group.entries.map((entry, index) => renderPythonCommand(entry, `${group.heading ?? activeCategory}-${entry.label}-${index}`))}</section>)}
            {mode === "python" && selectedPythonTemplate && <div className="python-options-panel"><div className="python-options-head"><div><strong>{selectedPythonTemplate.title}</strong><small>{selectedPythonTemplate.description}</small></div><button aria-label="Close command options" onClick={() => setSelectedPythonEntry(null)}>×</button></div><div className="python-option-fields">{selectedPythonTemplate.fields.map((field) => <label key={field.key}><span>{field.label}</span>{field.type === "select" ? <select value={pythonOptionValues[field.key] ?? field.defaultValue} onChange={(e) => setPythonOptionValues((old) => ({ ...old, [field.key]: e.target.value }))}>{field.choices?.map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select> : <input type={field.type} value={pythonOptionValues[field.key] ?? field.defaultValue} min={field.min} max={field.max} step={field.step} onChange={(e) => setPythonOptionValues((old) => ({ ...old, [field.key]: e.target.value }))} />}</label>)}</div><div className="python-option-preview"><span>Code preview</span><code><PythonSyntax code={selectedPythonPreview} /></code></div><button className="insert-custom-command" onClick={() => insertPythonCode(selectedPythonPreview)}>＋ Insert at cursor</button></div>}
          </div>
        </>}
      </aside>
      <div className="workspace-panel"><div className="workspace-toolbar"><div className="mode-switch" aria-label="Programming language"><button className={mode === "blocks" ? "active" : ""} onClick={() => setMode("blocks")}>▦ Blocks</button><button className={mode === "python" ? "active" : ""} onClick={() => setMode("python")}>⌨ Python</button></div><div className="edit-actions"><button onClick={undo} title="Undo">↶</button><button onClick={redo} title="Redo">↷</button><button onClick={restoreWorking}>Restore working</button><button onClick={resetWorkspace}>Reset starter</button></div><span className="workspace-label">{mode === "blocks" ? "Blocks Project" : "Python Project"} • saved separately</span><ExecutionButtons runState={runState} speed={speed} setSpeed={setSpeed} onRun={startRun} onPause={pauseRun} onStep={stepRun} onStop={stopRun} /></div>
        {mode === "blocks" ? <div className="block-workspace"><div className="grid-dots" /><div className="block-stack">{blocks.map((block, index) => <div key={block.id} className={classNames("program-block", `kind-${block.kind}`, selectedBlock === block.id && "selected", runIndex === index && ["running", "paused", "waiting"].includes(runState) && "executing")} onClick={() => setSelectedBlock(block.id)}><span className="block-grip">⋮⋮</span><span>{block.label}</span>{block.kind !== "event" && <button aria-label={`Delete ${block.label}`} onClick={(event) => { event.stopPropagation(); setBlocksWithHistory(blocks.filter((b) => b.id !== block.id)); }}>×</button>}{runIndex === index && ["running", "paused", "waiting"].includes(runState) && <em>{runState === "waiting" ? "waiting" : "now"}</em>}</div>)}<button className="add-hint" onClick={() => setActiveCategory("Motion")}>＋ Choose a block from the Toolbox</button></div></div> : <div className="python-workspace"><div className="python-filebar"><span><b>PY</b> main.py</span><span>Python • Line {pythonCursor.line}, Column {pythonCursor.column}</span></div><div className="python-editor-shell"><div ref={pythonLineRailRef} className="line-rail">{python.split("\n").map((_, index) => <span key={index} className={classNames(activeProgram[runIndex]?.sourceLine === index && runState !== "ready" && "active", pythonMessages.some((message) => message.severity === "error" && message.line === index + 1) && "has-error", pythonMessages.some((message) => message.severity === "warning" && message.line === index + 1) && "has-warning")}>{index + 1}</span>)}</div><div className="python-editor-pane"><pre ref={pythonHighlightRef} className="python-highlight" aria-hidden="true"><PythonSyntax code={python} />{"\n"}</pre><textarea ref={pythonEditorRef} spellCheck={false} aria-label="Python editor" value={python} onKeyDown={handlePythonKeyDown} onScroll={(e) => syncPythonScroll(e.currentTarget)} onSelect={(e) => rememberPythonSelection(e.currentTarget)} onChange={(e) => { setPython(e.target.value); rememberPythonSelection(e.currentTarget); queuePythonHistory(e.target.value); }} /></div></div></div>}
      </div>
      <aside className="help-panel"><div className="panel-heading"><div><span className="eyebrow">CHECK MY CODE</span><h2>{mode === "python" ? "Python helper" : "Block helper"}</h2></div><button onClick={() => setShowChecks(!showChecks)}>{showChecks ? "−" : "+"}</button></div>{showChecks && <div className="message-list">{(mode === "python" ? pythonMessages : blockMessages).map((message, index) => <article key={index} className={`message ${message.severity}`}><span>{message.severity === "error" ? "!" : message.severity === "warning" ? "△" : "✓"}</span><div><strong>{message.title}</strong><p>{message.detail}</p></div></article>)}</div>}<div className="quick-watch"><span className="eyebrow">LIVE WATCH</span><SensorRows sensors={sensors} /></div><div className="tip-card"><strong>Try Step</strong><p>The yellow outline shows exactly which block or line is happening.</p></div></aside>
    </section>
      <section className="embedded-simulator" aria-label="Live robot simulator">
        <div className="embedded-sim-header"><div><span className="eyebrow">LIVE SIMULATOR</span><strong>Watch your code run</strong></div><div className="simulator-actions"><label className="playground-picker"><span>Playground</span><select aria-label="Choose simulator playground" value={playgroundId} onChange={(event) => changePlayground(event.target.value as PlaygroundId)}>{PLAYGROUNDS.map((playground) => <option key={playground.id} value={playground.id}>{playground.name}</option>)}</select></label><button className="reset-robot" onClick={resetRobot}>↻ Reset Robot</button><button className="reset-robot reset-floor" onClick={resetPlayground}>↺ Reset Floor</button><ExecutionButtons runState={runState} speed={speed} setSpeed={setSpeed} onRun={startRun} onPause={pauseRun} onStep={stepRun} onStop={stopRun} /></div></div>
        <div className="embedded-sim-body">
          <div className="embedded-field-column">
            <div className={classNames("field", `floor-${currentPlayground.theme}`, collision && "collision")}><div className="field-grid" />{worldObjects.filter((obstacle) => obstacle.goal).map((obstacle) => <div key={`${obstacle.id}-goal`} className={classNames("crate-goal", deliveredIds.includes(obstacle.id) && "complete")} style={{ left: `${obstacle.goal!.x}%`, top: `${obstacle.goal!.y}%`, width: `${obstacle.goal!.width}%`, height: `${obstacle.goal!.height}%` }} title={obstacle.goal!.label}><span>{deliveredIds.includes(obstacle.id) ? "DELIVERED" : "PUSH HERE"}</span></div>)}{debris.map((piece) => <div key={`${piece.id}-debris`} className="structure-debris" style={{ left: `${piece.x}%`, top: `${piece.y}%`, width: `${piece.width}%`, height: `${piece.height}%` }}><span>DEBRIS</span></div>)}{worldObjects.map((obstacle) => <div key={obstacle.id} className={classNames("field-obstacle", obstacle.kind, obstacle.behavior, deliveredIds.includes(obstacle.id) && "delivered")} style={{ left: `${obstacle.x}%`, top: `${obstacle.y}%`, width: `${obstacle.width}%`, height: `${obstacle.height}%` }} title={`${obstacle.label}${obstacle.behavior === "pushable" ? " — pushable" : obstacle.behavior === "breakable" ? " — breakable" : ""}`}><span>{obstacle.kind === "crate" ? "CRATE" : obstacle.kind === "structure" ? "BREAKAWAY" : "WALL"}</span></div>)}<span className="start-label">START</span><div className="playground-name">{currentPlayground.name}{worldObjects.some((obstacle) => obstacle.goal) && <small>{deliveredIds.length}/{worldObjects.filter((obstacle) => obstacle.goal).length} delivered</small>}</div>{collision && <div className="collision-banner">⚠ Blocked — {runState === "finished" ? "motors still running" : "code is still RUNNING"}</div>}<div className="robot" style={{ left: `${robot.x}%`, top: `${robot.y}%`, transform: `translate(-50%, -50%) rotate(${robot.heading}deg)` }}><div className="robot-body"><span>V5</span><b>FRONT ▶</b><i className={classNames("robot-led", sensors.led && "on")} role="img" aria-label={`Robot LED ${sensors.led ? "on" : "off"}`} title={`led_f is ${sensors.led ? "ON" : "OFF"}`} /></div><i className={classNames("wheel", "wheel-left", leftDirection !== 0 && "spinning")} /><i className={classNames("wheel", "wheel-right", rightDirection !== 0 && "spinning")} /></div><div className="field-readout">x {Math.round(robot.x * 5)} • y {Math.round(robot.y * 2.4)} • {Math.round(robot.heading)}°</div></div>
            <div className="execution-strip"><span className={`run-dot ${runState}`} /><div><small>{runState.toUpperCase()}</small><strong>{lastAction}</strong></div><div className="step-count">Step {Math.min(runIndex + 1, activeProgram.length)} of {activeProgram.length}</div></div>
            <div className="embedded-motor-strip"><MotorCard name={leftDriveDevice?.name ?? "No left drive motor"} port={leftDriveDevice?.port ?? "—"} velocity={leftVelocity} direction={leftDriveDevice ? leftDirection : 0} /><MotorCard name={rightDriveDevice?.name ?? "No right drive motor"} port={rightDriveDevice?.port ?? "—"} velocity={rightVelocity} direction={rightDriveDevice ? rightDirection : 0} /></div>
            <div className="embedded-output-strip"><div><span className="eyebrow">BRAIN SCREEN</span><pre>{brainText || " "}</pre></div><div><span className="eyebrow">LATEST CONSOLE MESSAGE</span><code>{consoleLines.at(-1) ?? "Simulator ready."}</code></div></div>
          </div>
          <aside className="sensor-lab embedded-sensor-lab"><div className="sensor-lab-head"><span className="eyebrow">CLASSROOM TESTBED</span><h2>Interactive Sensors</h2><p>Change these while the highlighted code runs.</p></div><SwitchSensor label="Bumper Switch" port="A" name="bumper_a" pressed={sensors.bumper} onChange={(pressed) => setSensors((old) => ({ ...old, bumper: pressed }))} /><SwitchSensor label="Limit Switch" port="B" name="limit_switch_b" pressed={sensors.limit} onChange={(pressed) => setSensors((old) => ({ ...old, limit: pressed }))} limit /><SliderSensor label="Light Sensor" port="C" name="light_c" value={sensors.light} unit="% bright" onChange={(light) => setSensors((old) => ({ ...old, light }))} icon="☀" /><div className="sensor-card"><SensorHeader label="Line Tracker" port="D" name="line_tracker_d" value={`${sensors.line}%`} /><div className="surface-choices">{[[92, "White"], [52, "Gray"], [12, "Black"]].map(([value, label]) => <button key={label} className={sensors.line === value ? "selected" : ""} onClick={() => setSensors((old) => ({ ...old, line: Number(value) }))}><i className={`surface ${String(label).toLowerCase()}`} />{label}</button>)}</div></div><SliderSensor label="Potentiometer" port="E" name="potentiometer_e" value={sensors.pot} unit="% angle" onChange={(pot) => setSensors((old) => ({ ...old, pot }))} icon="◉" /><div className="sensor-card led-sensor"><SensorHeader label="Indicator LED" port="F" name="led_f" value={sensors.led ? "ON" : "OFF"} /><div className={sensors.led ? "large-led on" : "large-led"} /><p>The program controls this output.</p></div></aside>
        </div>
      </section>
    </section>}

    {view === "simulator" && <section className="simulator-view"><div className="simulator-left"><div className="section-title-row"><div><span className="eyebrow">VIRTUAL TEST AREA</span><h1>Robot Simulator</h1></div><div className="simulator-actions"><button className="reset-robot" onClick={resetRobot}>↻ Reset Robot</button><ExecutionButtons runState={runState} speed={speed} setSpeed={setSpeed} onRun={startRun} onPause={pauseRun} onStep={stepRun} onStop={stopRun} /></div></div><div className="field"><div className="field-grid" /><span className="start-label">START</span><div className="robot" style={{ left: `${robot.x}%`, top: `${robot.y}%`, transform: `translate(-50%, -50%) rotate(${robot.heading}deg)` }}><div className="robot-body"><span>V5</span><b>FRONT ▶</b></div><i className={classNames("wheel", "wheel-left", leftDirection !== 0 && "spinning")} /><i className={classNames("wheel", "wheel-right", rightDirection !== 0 && "spinning")} /></div><div className="field-readout">x {Math.round(robot.x * 5)} • y {Math.round(robot.y * 2.4)} • {Math.round(robot.heading)}°</div></div><div className="execution-strip"><span className={`run-dot ${runState}`} /><div><small>{runState.toUpperCase()}</small><strong>{lastAction}</strong></div><div className="step-count">Step {Math.min(runIndex + 1, activeProgram.length)} of {activeProgram.length}</div></div><div className="bottom-sim-grid"><div className="motor-bench"><div className="card-title"><strong>Motor Test Bench</strong><span>live</span></div><MotorCard name={leftDriveDevice?.name ?? "No left drive motor"} port={leftDriveDevice?.port ?? "—"} velocity={leftVelocity} direction={leftDriveDevice ? leftDirection : 0} /><MotorCard name={rightDriveDevice?.name ?? "No right drive motor"} port={rightDriveDevice?.port ?? "—"} velocity={rightVelocity} direction={rightDriveDevice ? rightDirection : 0} /></div><div className="brain-card"><div className="card-title"><strong>V5 Brain Screen</strong><span>480 × 240</span></div><pre>{brainText || " "}</pre><div className="led-row"><span className={sensors.led ? "led on" : "led"} />led_f is {sensors.led ? "ON" : "OFF"}</div></div><div className="console-card"><div className="card-title"><strong>Program Console</strong><button onClick={() => setConsoleLines([])}>Clear</button></div>{consoleLines.map((line, index) => <p key={index}>{line}</p>)}</div></div></div>
      <aside className="sensor-lab"><div className="sensor-lab-head"><span className="eyebrow">CLASSROOM TESTBED</span><h2>Interactive Sensors</h2><p>Change these while your program is running.</p></div><SwitchSensor label="Bumper Switch" port="A" name="bumper_a" pressed={sensors.bumper} onChange={(pressed) => setSensors((old) => ({ ...old, bumper: pressed }))} /><SwitchSensor label="Limit Switch" port="B" name="limit_switch_b" pressed={sensors.limit} onChange={(pressed) => setSensors((old) => ({ ...old, limit: pressed }))} limit /><SliderSensor label="Light Sensor" port="C" name="light_c" value={sensors.light} unit="% bright" onChange={(light) => setSensors((old) => ({ ...old, light }))} icon="☀" /><div className="sensor-card"><SensorHeader label="Line Tracker" port="D" name="line_tracker_d" value={`${sensors.line}%`} /><div className="surface-choices">{[[92, "White"], [52, "Gray"], [12, "Black"]].map(([value, label]) => <button key={label} className={sensors.line === value ? "selected" : ""} onClick={() => setSensors((old) => ({ ...old, line: Number(value) }))}><i className={`surface ${String(label).toLowerCase()}`} />{label}</button>)}</div></div><SliderSensor label="Potentiometer" port="E" name="potentiometer_e" value={sensors.pot} unit="% angle" onChange={(pot) => setSensors((old) => ({ ...old, pot }))} icon="◉" /><div className="sensor-card led-sensor"><SensorHeader label="Indicator LED" port="F" name="led_f" value={sensors.led ? "ON" : "OFF"} /><div className={sensors.led ? "large-led on" : "large-led"} /><p>The program controls this output.</p></div></aside></section>}

    {view === "setup" && <section className="setup-view">
      <div className="setup-main">
        <div className="section-title-row"><div><span className="eyebrow">ROBOT SETUP</span><h1>Classroom Testbed</h1><p>Click any port to change its connected device.</p></div><button className="primary" onClick={usePLTWTestbed}>↻ Use PLTW Testbed Setup</button></div>
        <div className="brain-layout">
          <div className="brain-visual">
            <div className="brain-screen"><b>V5</b><span>Classroom Testbed</span></div>
            <div className="three-wire-bank"><strong>3-WIRE</strong>{["A", "B", "C", "D", "E", "F", "G", "H"].map((port) => { const attached = devices.find((device) => device.port === port); return <button key={port} className={classNames("three-wire-port", attached && "used", selectedSetupPort === port && "selected")} title={attached ? `${port}: ${attached.name} • ${attached.type}` : `${port}: not connected`} onClick={() => setSelectedSetupPort(port)}>{port}</button>; })}</div>
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map((port) => <button key={port} className={classNames("smart-port", devices.some((d) => d.port === String(port)) && "used", selectedSetupPort === String(port) && "selected")} title={`Smart Port ${port}`} onClick={() => setSelectedSetupPort(String(port))}>{port}</button>)}
          </div>
          <div className="wire-devices">
            <div className="port-editor">
              <div className="port-editor-title"><span className="port-badge">{selectedSetupPort}</span><div><strong>{selectedSetupPortIsSmart ? `Smart Port ${selectedSetupPort}` : `3-Wire Port ${selectedSetupPort}`}</strong><small>{selectedSetupDevice ? "Connected device" : "Not connected"}</small></div></div>
              <label><span>Device</span><select value={selectedSetupDevice?.type ?? ""} onChange={(event) => setSetupPortType(selectedSetupPort, event.target.value)}><option value="">Nothing connected</option>{selectedSetupDeviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              {selectedSetupDevice && <><label><span>Python name</span><input value={selectedSetupDevice.name} onChange={(event) => updateSetupDevice(selectedSetupPort, { name: event.target.value.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^([0-9])/, "_$1") })} /></label>{selectedSetupDevice.type === "Smart Motor" && <label><span>Simulator role</span><select value={selectedSetupDevice.role ?? "Mechanism"} onChange={(event) => updateSetupDevice(selectedSetupPort, { role: event.target.value })}><option>Mechanism</option><option>Left drive</option><option>Right drive</option></select></label>}<button className="clear-port" onClick={() => setSetupPortType(selectedSetupPort, "")}>Clear Port {selectedSetupPort}</button></>}
              <p>Connected ports glow on the Brain. Select another port to configure it.</p>
            </div>
            {devices.map((device) => <article key={device.port} className={selectedSetupPort === device.port ? "selected" : ""}><span className="port-badge">{device.port}</span><div><strong>{device.name}</strong><small>{device.type}{device.role ? ` • ${device.role}` : ""}</small></div><div className="device-card-actions"><button onClick={() => setSelectedSetupPort(device.port)}>Edit</button><button onClick={() => setDevices((items) => items.filter((item) => item.port !== device.port))}>Remove</button></div></article>)}
          </div>
        </div>
      </div>
      <aside className="checklist-panel"><span className="eyebrow">PLTW PRESET CHECK</span><h2>{testbedOkay ? "PLTW setup matches" : "Custom setup active"}</h2><p>{testbedOkay ? "Your ports match the PLTW classroom testbed." : "Your custom port choices are saved. Use the preset button whenever you want the original PLTW setup back."}</p><div className="setup-checks">{testbedStatus.map(({ expected, actual, ok }) => <div key={expected.port} className={ok ? "ok" : "bad"}><span>{ok ? "✓" : "!"}</span><div><strong>Port {expected.port}: {expected.name}</strong><small>{actual ? `Found ${actual.name}` : "Device is missing"}</small></div></div>)}</div><button className="primary wide" onClick={usePLTWTestbed}>Use PLTW Testbed Setup</button></aside>
    </section>}

    {view === "code" && <section className="code-view"><div className="code-card"><div className="section-title-row"><div><span className="eyebrow">GENERATED CODE</span><h1>{mode === "blocks" ? "Python from Blocks" : "Your Python Project"}</h1></div><button className="primary" onClick={() => navigator.clipboard.writeText(mode === "blocks" ? blockPython : python)}>Copy code</button></div><pre>{mode === "blocks" ? blockPython : python}</pre></div><aside className="reference-card"><span className="eyebrow">ROBOT SETUP REFERENCE</span><h2>Device names</h2>{devices.map((device) => <div key={device.port}><code>{device.name}</code><span>Port {device.port}</span></div>)}<h3>Remember</h3><p>Blocks and Python are independent projects. Switching views never replaces your work.</p></aside></section>}

    {view === "guide" && <section className="guide-view"><div className="guide-hero"><span className="eyebrow">STUDENT GUIDE</span><h1>Build code one small test at a time.</h1><p>Set up the testbed, make one change, test it in the simulator, and then add the next chunk.</p></div><div className="guide-steps">{[["1", "Check Setup", "Make sure every classroom device has a green check."], ["2", "Choose a workspace", "Blocks and Python stay separate, so use the one your teacher assigns."], ["3", "Step through it", "Watch the yellow highlight move one instruction at a time."], ["4", "Change a sensor", "Press switches or move sliders while the program waits."], ["5", "Fix friendly messages", "The helper explains the problem and where to look."], ["6", "Save your project", "Autosave protects your work; Save file makes a copy you can submit."]].map(([number, title, detail]) => <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div></article>)}</div><div className="help-callout"><strong>Stuck?</strong><p>Try <b>Stop → Restore working → Step</b>. This returns to your last successful test and lets you watch it slowly.</p></div></section>}
  </main>;
}

function ExecutionButtons({ runState, speed, setSpeed, onRun, onPause, onStep, onStop }: { runState: RunState; speed: number; setSpeed: (speed: number) => void; onRun: () => void; onPause: () => void; onStep: () => void; onStop: () => void }) { return <div className="execution-buttons"><button className="run" onClick={onRun}>▶ Run</button><button onClick={onPause}>{runState === "paused" ? "▶ Resume" : "Ⅱ Pause"}</button><button onClick={onStep}>↦ Step</button><button onClick={onStop}>■ Stop</button><select aria-label="Code execution speed" title="Fast removes the teaching delay between ordinary instructions. Timed movement and wait commands stay realistic." value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={0.5}>Slow</option><option value={1}>Normal</option><option value={FAST_CODE_SPEED}>Fast</option></select></div>; }
function SensorRows({ sensors }: { sensors: { bumper: boolean; limit: boolean; light: number; line: number; pot: number; led: boolean } }) { return <div className="sensor-rows"><div><span>bumper_a</span><b>{sensors.bumper ? "PRESSED" : "released"}</b></div><div><span>limit_switch_b</span><b>{sensors.limit ? "PRESSED" : "released"}</b></div><div><span>light_c</span><b>{sensors.light}%</b></div><div><span>line_tracker_d</span><b>{sensors.line}%</b></div><div><span>potentiometer_e</span><b>{sensors.pot}%</b></div><div><span>led_f</span><b>{sensors.led ? "ON" : "OFF"}</b></div></div>; }
function MotorCard({ name, port, velocity, direction }: { name: string; port: string; velocity: number; direction: number }) { return <div className="motor-card"><div className="motor-icon"><div className={direction ? "shaft active" : "shaft"} /></div><div><strong>{name}</strong><small>Smart Port {port}</small></div><b>{direction === 0 ? "Stopped" : direction > 0 ? "Forward" : "Reverse"}<small>{velocity}%</small></b></div>; }
function SensorHeader({ label, port, name, value }: { label: string; port: string; name: string; value: string }) { return <div className="sensor-header"><span className="port-badge">{port}</span><div><strong>{label}</strong><small>{name}</small></div><b>{value}</b></div>; }
function SwitchSensor({ label, port, name, pressed, onChange, limit = false }: { label: string; port: string; name: string; pressed: boolean; onChange: (value: boolean) => void; limit?: boolean }) { return <div className="sensor-card"><SensorHeader label={label} port={port} name={name} value={pressed ? "1 • PRESSED" : "0 • released"} /><button className={classNames("physical-switch", pressed && "pressed", limit && "limit")} onPointerDown={() => onChange(true)} onPointerUp={() => onChange(false)} onPointerLeave={() => onChange(false)}><i /><span>{pressed ? "Hold — pressed" : "Press and hold"}</span></button><button className={classNames("sensor-latch", pressed && "active")} onClick={() => onChange(!pressed)}>{pressed ? "Release latched sensor" : "Keep pressed for Run"}</button></div>; }
function SliderSensor({ label, port, name, value, unit, onChange, icon }: { label: string; port: string; name: string; value: number; unit: string; onChange: (value: number) => void; icon: string }) { return <div className="sensor-card"><SensorHeader label={label} port={port} name={name} value={`${value}%`} /><div className="slider-row"><span>{icon}</span><input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} /><small>{unit}</small></div></div>; }
