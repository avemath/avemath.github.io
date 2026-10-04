---
title: RAMpage Combat Robot
short: RAMpage
type: engineering
tags: [engineering]
featured: true
order: 6
period: { start: "2024-08", end: "2025-05" }
status: complete
summary: Senior design capstone. I wrote the control software for a 30 lb pneumatic combat robot, splitting weapon safety and live video across two controllers so neither could stall the other.
outcome: First place in the LSU senior design combat robotics competition.
role: Lead programmer and systems integration. I owned the Pico W weapon and safety firmware, the Pi 4B video pipeline, and the test scripts.
team: Five-person senior design team, advised by Dr. Adrian Stein.
seoDescription: "Control software for a 30 lb pneumatic combat robot: weapon safety on a Pico W, live video on a Pi 4B, and first place in LSU's senior design competition."
keywords: ["robot", "combat robotics", "senior design", "capstone", "firmware", "pneumatic", "kill switch", "UDP video"]
stack: [MicroPython, Python, Raspberry Pi Pico W, Raspberry Pi 4B, OpenCV, UDP, FlySky RC]
links:
  repo: https://github.com/avemath/RAMpage
cover: ../../assets/projects/rampage/lid.jpg
coverAlt: The robot's top plate, black with "RAMpage" hand-painted in red graffiti letters outlined in white, rivet heads showing through the paint.
gallery:
  - video: /media/rampage-arena.mp4
    poster: ../../assets/projects/rampage/arena-poster.jpg
    captions: /media/rampage-arena.vtt
    loop: true
    alt: Overhead video of a match in the combat robotics arena. Two robots cross a plywood floor while the crowd watches from behind the barrier.
    caption: A few seconds of a match, from the arena camera.
  - src: ../../assets/projects/rampage/internals.jpg
    alt: Top-down view inside the chassis with the lid off. Two silver air tanks run front to back, solenoid valves and black air lines sit across the top, and the control electronics are wired in between the tanks.
    caption: Under the lid. Two air tanks feed the plow through the solenoid valves, and the control boards sit between them.
  - src: ../../assets/projects/rampage/bench.jpg
    alt: Bench wiring on a blue mat. A Raspberry Pi Pico W on a green carrier board, a FlySky FS-iA6B receiver, a small power board taped to a battery, and the valves and motors in the background.
    caption: Bench wiring before it went into the chassis, with the Pico W, the FS-iA6B receiver and the power board laid out on the mat.
  - src: ../../assets/projects/rampage/test-stand.jpg
    alt: The robot standing on end on a load-test machine with its frame open, the two air tanks and the wiring exposed, and a force transducer mounted on a crossbar above it.
    caption: Upright on a load-test stand in the lab, with a force transducer mounted above it.
  - src: ../../assets/projects/rampage/shop-lid.jpg
    alt: The robot on a wooden shop bench with its painted lid on. A hacksaw, clamps and a roll of shop towels sit behind it.
    caption: Lid on, back on the shop bench.
  - src: ../../assets/projects/rampage/pico.jpg
    alt: Close-up of the Raspberry Pi Pico W on its carrier board, with jumper wires on the RC input and solenoid output pins and a micro USB cable attached.
    caption: The Pico W that times the RC pulses and sequences the valves. Two input pins, two output pins, nothing else to wait on.
  - src: ../../assets/projects/rampage/video-feed.jpg
    alt: A laptop showing the robot's camera feed in a window with a green frame-rate overlay, beside a terminal full of log lines.
    caption: The driver's view during testing. The Pi 4B's UDP stream with its frame-rate overlay, and the receiver's log beside it.
  - src: ../../assets/projects/rampage/control-flow.jpg
    alt: Flowchart of the robot's control software. Setup initializes the Pi 4, the Pico W, the accelerometer, the motors and the camera and pairs the controller. A main loop then reads the controller, streams camera footage over UDP, watches the accelerometer for a flipped robot or a rapid deceleration, fires the weapon on a front impact or a manual trigger, and shuts down on the kill switch.
    caption: The control flow. One loop reads the controller, streams video, watches the accelerometer for flips and front impacts, and fires or resets the weapon.
metrics:
  - { label: Result, value: "1st place" }
  - { label: Plow strikes per match, value: "17" }
  - { label: Max frame size, value: "65,000 B" }
demo: weapon-logic
---

## Context

Combat is a rough place for electronics: vibration, interference, flaky radio links and a limited tank of air. RAMpage was a 30 lb combat robot with a pneumatic plow, built by a five-person team for LSU's senior design combat robotics competition. The software had two jobs that pull in opposite directions. The weapon and safety logic has to react on time, every time. Live video for the driver needs a full Linux computer, and Linux doesn't promise anything about timing.

## My role

I was the lead programmer and handled systems integration. I wrote the weapon and safety firmware on the Pico W, the video pipeline on the Pi 4B and the receiver on the driver's laptop, plus the scripts we used to test latency and heat.

## Approach

**Split by criticality.** Drive never touches either computer: the RC receiver feeds the speed controllers directly, so a software crash can't take away steering. The Pico W reads only two switch channels and runs the weapon. The Pi 4B only does video. Neither one waits on the other.

**Read the radio directly.** The Pico times RC pulses with pin interrupts on both edges in microseconds. Anything outside 900 to 2100 µs is thrown out as noise, and a switch only counts as on above 1700 µs and off below 1300 µs.

**Fire in a fixed sequence.** Each strike vents the main valve, waits, closes it, then drives the piston valve for 400 ms before resetting. Firing is edge-triggered, so holding the switch fires once, not repeatedly. There's a 500 ms cooldown, and the robot carries enough air for 17 strikes. The firmware counts them and locks out at zero instead of firing on an empty tank.

**Fail safe three ways.** The weapon stops if the kill switch is flipped, if either channel goes quiet for more than a second, or if the kill switch is already on at power-up. Each cause has its own recovery rule, and in every stop state both valves go to their safe positions. The status LED tells the pit crew which state it's in from across the arena.

**Video that stays current.** In live control, a slightly old frame shown on time beats a perfect frame shown late, so video goes over UDP instead of TCP. Each frame is JPEG-encoded, and the quality steps down from 80 to 50 until the frame fits in a single 65,000-byte datagram. If it still doesn't fit, the frame is skipped instead of split. Every frame carries a burned-in timestamp so we could check latency by eye, and the laptop shows "NO SIGNAL" and reconnects on its own if frames stop.

**Test what scares you.** I wrote a latency test that measures from the trigger pulse to the solenoid pin, with a 50 ms target, and a thermal logger for the Pi inside a sealed enclosure.

## Outcome

RAMpage took first place in the senior design combat robotics competition.

## What I'd do next

Going back through the firmware to build the simulator above, I found two things I'd fix.

**Re-arm after an E-stop.** The trigger's last state isn't updated while the board is in an E-stop. If the driver flips the trigger on during a stop, the plow fires the moment the stop clears, because it looks like a fresh press. The fix is to require the trigger to be seen off before the weapon re-arms.

**Never block the safety loop.** The firing sequence sleeps for about half a second, so the kill switch isn't checked mid-strike. A small state machine on a timer would keep the safety checks running the whole time.

I'd also log latency and temperature results to files instead of the console, so the numbers outlive the test day.
