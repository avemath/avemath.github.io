---
title: RAMpage Combat Robot
short: RAMpage
type: engineering
tags: [engineering]
featured: true
order: 1
period: { start: "2024-08", end: "2025-05" }
status: complete
summary: Senior design capstone. I wrote the control software for a 30 lb pneumatic combat robot, splitting weapon safety and live video across two controllers so neither could stall the other.
outcome: First place in the LSU senior design combat robotics competition.
role: Lead programmer and systems integration. I owned the Pico W weapon and safety firmware, the Pi 4B video pipeline, and the test scripts.
team: "Avery Matherne (control software, systems integration), Chris Cashen, Nicholas Woodroffe, Matthew van Winkle and Miles Mouton, advised by Dr. Adrian Stein."
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
    alt: Overhead video of a match in the combat robotics arena. RAMpage pushes another team's robot across the plywood floor and off the stage while the crowd watches from behind the barrier.
    caption: A few seconds of a match from the arena camera. After the other robot hit ours, RAMpage pushed it off the stage.
  - src: ../../assets/projects/rampage/pico.jpg
    alt: Close-up of the Raspberry Pi Pico W on its carrier board, with jumper wires on the RC input and solenoid output pins and a micro USB cable attached.
    caption: The Pico W that times the RC pulses and sequences the valves. Two input pins, two output pins, nothing else to wait on.
  - src: ../../assets/projects/rampage/video-feed.jpg
    alt: A laptop showing the robot's camera feed in a window with a green frame-rate overlay, beside a terminal full of log lines.
    caption: The driver's view during testing. The Pi 4B's UDP stream with its frame-rate overlay, and the receiver's log beside it.
  - src: ../../assets/projects/rampage/test-stand.jpg
    alt: The robot standing on end on a load-test machine with its frame open, the two air tanks exposed, and a force transducer mounted on a crossbar above it.
    caption: Upright on a load-test stand in the lab for the mechanical team's load-cell test.
  - src: ../../assets/projects/rampage/shop-lid.jpg
    alt: The robot on a wooden shop bench with its painted lid on. A hacksaw, clamps and a roll of shop towels sit behind it.
    caption: Lid on, back on the shop bench.
metrics:
  - { label: Result, value: "1st place" }
  - { label: Activations allowed by firmware, value: "17" }
  - { label: Trigger to solenoid, average, value: "31.5 ms" }
  - { label: Max frame size, value: "65,000 B" }
demo: weapon-logic
---

## Context

Combat is a rough place for electronics: vibration, interference, flaky radio links and a limited tank of air. RAMpage was a 30 lb combat robot with a pneumatic plow, built by a five-person team for LSU's senior design combat robotics competition. The software had two jobs that pull in opposite directions. The weapon and safety logic has to react on time, every time. Live video for the driver needs a full Linux computer, and Linux doesn't promise anything about timing.

## My role

The team was Avery Matherne (control software and systems integration), Chris Cashen, Nicholas Woodroffe, Matthew van Winkle and Miles Mouton. The mechanical design and the pneumatic analysis were the mechanical team's work. I wrote the three programs: `pico_direct.py` (weapon and safety firmware on the Pico W), `pi4_direct.py` (the video pipeline on the Pi 4B) and `video_direct.py` (the receiver on the driver's laptop), plus the scripts we used to test latency and heat.

## Approach

**Split by criticality.** Drive never touches either computer: the RC receiver feeds the speed controllers directly, so a software crash can't take away steering. The Pico W reads only two switch channels and runs the weapon. The Pi 4B only does video. Neither one waits on the other.

**Read the radio directly.** The Pico times RC pulses with pin interrupts on both edges in microseconds. Anything outside 900 to 2100 µs is thrown out as noise, and a switch only counts as on above 1700 µs and off below 1300 µs.

**The pneumatics, as built.** Two seamless aluminum reservoirs rated 200 psi are charged before a match from an external compressor through a Schrader valve; there is no compressor on the robot, for vibration, power and weight. Each reservoir has its own quarter-inch inlet solenoid valve (12 V, 8.5 W), and both inlets open together on GP15. They feed one shared supply line, which drives two pneumatic cylinders, one above the other, each with its own rod and both pushing the one plow, about 80 lbf per cylinder at 200 psi. A half-inch exhaust solenoid valve (12 V, 16 W) on GP14 branches off the shared line to atmosphere. It sits open when idle so the plow stays pulled in, and it is forced open on any error or emergency stop.

**Fire in a fixed sequence.** Each strike runs six steps: the exhaust stays open for 50 ms with the plow home, the exhaust closes, a 50 ms dwell, both inlets open for 400 ms to drive the plow out to full extension, the inlets close, and the exhaust reopens so the plow vents and retracts. Firing is edge-triggered, so holding the switch fires once, not repeatedly. There's a 500 ms cooldown and a hard limit of 17 activations in firmware, of which about the first six deliver full force before reservoir pressure drops. The team's air analysis predicted five cycles above 30 lbf; testing measured six.

**Fail safe three ways.** The kill switch is RC channel 5 and the weapon trigger is channel 6. A kill, a lost signal (either channel quiet for more than a second) or an error forces the exhaust open and cuts power to the FlySky receiver through a solid-state relay, which puts the motor controllers into failsafe. The kill switch also blocks firing if it is already on at power-up. The drive motors connect from the receiver straight to the ESC, with no software in the path. The status LED tells the pit crew which state the board is in from across the arena.

**Video that stays current.** In live control, a slightly old frame shown on time beats a perfect frame shown late, so video from a fisheye Pi camera goes over UDP instead of TCP. Each frame is JPEG-encoded, and the adaptive quality steps down from 80 to 50 until the frame fits in a single 65,000-byte datagram. With an external antenna the stream averaged 17.4 FPS, 11.2 FPS more than with the internal antenna. If it still doesn't fit, the frame is skipped instead of split. Every frame carries a burned-in timestamp so we could check latency by eye, and the laptop shows "NO SIGNAL" and reconnects on its own if frames stop.

**Electronics.** A 4-in-1 BLHeli_32 70 A ESC, 650 Kv brushless motors, a 5S LiPo, a 100 A maxi fuse, and a 5 V to 3.3 V level shifter between the Pico and the 5 V side.

**Test what scares you.** I wrote a latency test that measures from the trigger pulse to the solenoid pin against a 50 ms target: it measured 28 to 36 ms, 31.5 ms on average. The kill switch cuts power within 35 ms. I also wrote a thermal logger for the Pi inside a sealed enclosure.

## Outcome

RAMpage took first place in the senior design combat robotics competition.

## What I'd do next

Going back through the firmware to build the simulator above, I found two things I'd fix.

**Re-arm after an E-stop.** The trigger's last state isn't updated while the board is in an E-stop. If the driver flips the trigger on during a stop, the plow fires the moment the stop clears, because it looks like a fresh press. The fix is to require the trigger to be seen off before the weapon re-arms.

**Never block the safety loop.** The firing sequence sleeps for about half a second, so the kill switch isn't checked mid-strike. A small state machine on a timer would keep the safety checks running the whole time.

I'd also log latency and temperature results to files instead of the console, so the numbers outlive the test day.
