Etudier French — Application Design Document

Goal

Build a desktop vocabulary learning application inspired by Skyeng-style training but focused on efficient word memorization, short sessions, and modular learning.

Learning language: French
Interface language: Russian

The application runs as a desktop app using React + TypeScript + Vite with a Tauri shell.

⸻

Core Concept

Users study vocabulary through modular lessons and vocabulary packs.

Design principles:
	•	one exercise per screen
	•	large clickable options
	•	strong audio usage
	•	clear progress visualization
	•	minimal UI clutter

⸻

Daily Lesson System

The daily lesson is divided into exactly five modules:
	1.	New words introduction
	2.	First practice
	3.	Review of learning words
	4.	Reinforcement
	5.	Final recap

The user always sees:
	•	current module
	•	current step
	•	daily progress

After finishing all modules the app shows:
“На сегодня заданий нет”

However users can continue learning using extra learning mode.

⸻

Extra Learning Mode

When the daily lesson ends, users may continue learning via:
	•	difficult words
	•	learning words
	•	vocabulary packs
	•	mixed exercises

This mode does not affect daily lesson completion.

⸻

Lesson Duration

Before starting a lesson the user chooses duration:
	•	10 minutes
	•	20 minutes
	•	30 minutes

Duration controls lesson size and exercise count.

The last chosen duration should be stored locally.

⸻

Vocabulary Packs

Vocabulary is organized into packs.

Starter packs:
	1.	Plants
	2.	Animals
	3.	Food
	4.	Travel
	5.	Home and Living

Each pack includes about 20+ words.

Pack screen shows:
	•	title
	•	description
	•	word count
	•	status

Users can open a pack and see the words inside.

Pack states:
	•	not_added
	•	added
	•	in_progress
	•	completed

⸻

Dictionary

Dictionary supports filters:
	•	all
	•	learning
	•	known
	•	mastered
	•	difficult

Word cards show:
	•	French word
	•	Russian translation
	•	transcription
	•	audio
	•	example sentence

Users can mark words as “Уже знаю”.

⸻

Word Status

Words have statuses:
	•	new
	•	learning
	•	known
	•	mastered
	•	difficult

Known words should not appear as new again.

⸻

Profile

The profile stores:
	•	username
	•	words learned
	•	mastered words
	•	difficult words
	•	learning streak
	•	completed lessons

History entries contain:
	•	lesson date
	•	modules completed
	•	mistakes
	•	words learned

History should appear as a timeline.

⸻

Exercises

Supported exercise types:
	1.	Audio → Translation
	2.	Translation → Original
	3.	Original → Translation
	4.	Audio → Word Input

Typing validation should ignore case and surrounding spaces.

⸻

Interface Structure

Home Screen

Shows:
	•	start/continue lesson
	•	daily progress
	•	lesson duration selector
	•	packs
	•	dictionary
	•	profile

Lesson Screen

Displays:
	•	module title
	•	step progress
	•	exercise
	•	answer feedback

Completion Screen

Displays:
	•	success rate
	•	mistakes
	•	repeat mistakes
	•	continue learning

⸻

UX Requirements

Interface must be:
	•	minimal
	•	modern
	•	intuitive

Design rules:
	•	large buttons
	•	clear typography
	•	card based layout

⸻

Audio

Each word must support:
	•	audio playback
	•	replay button

⸻

Persistence

Stored locally:
	•	profile
	•	learning history
	•	packs
	•	word statuses
	•	lesson progress

⸻

Technology

Frontend: React + TypeScript + Vite
Desktop shell: Tauri
Persistence: LocalStorage

⸻

Completion Criteria

The application is ready when:
	•	lessons function correctly
	•	packs work
	•	dictionary works
	•	profile history works
	•	extra learning works
	•	lesson duration works
	•	desktop build works
	•	no inactive buttons exist 