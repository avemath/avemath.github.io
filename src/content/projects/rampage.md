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
stack: [MicroPython, Python, Raspberry Pi Pico W, Raspberry Pi 4B, OpenCV, UDP, FlySky RC]
links:
  repo: https://github.com/avemath/RAMpage
metrics:
  - { label: Result, value: "1st place" }
  - { label: Plow strikes per match, value: "17" }
  - { label: Max frame size, value: "65,000 B" }
demo: weapon-logic
---

## Context

RAMpage was a 30 lb combat robot with a pneumatic plow, built by a five-person team for LSU's senior design combat robotics competition. Combat is a rough place for electronics: vibration, interference, flaky radio links and a limited tank of air. The software had two jobs that pull in opposite directions. The weapon and safety logic has to react on time, every time. Live video for the driver needs a full Linux computer, and Linux doesn't promise anything about timing.

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
