AGENTS.md

Project Overview

Etudier French is a desktop vocabulary learning application.

Core stack:
	•	React
	•	TypeScript
	•	Vite
	•	Tauri

Product constraints:
	•	Interface language must remain Russian.
	•	Learning language must remain French.
	•	The project must stay a desktop app.
	•	Existing working functionality should be preserved whenever possible.

⸻

Product Requirements

Daily Lesson
	•	The daily lesson must be divided into exactly 5 modules:
	1.	New words introduction
	2.	First practice of new words
	3.	Review of words in learning status
	4.	Reinforcement with mixed exercises
	5.	Final recap / mini-check
	•	The user must always see:
	•	current module name
	•	current step inside the module
	•	overall daily progress
	•	completed vs remaining modules
	•	After the 5 modules are completed, the app must show:
	•	“На сегодня заданий нет”
	•	Daily lesson completion must remain tracked by day.

Extra Learning Mode
	•	After daily lesson completion, the user must still be able to continue studying.
	•	Extra learning mode may use:
	•	difficult words
	•	learning words
	•	pack practice
	•	mixed reinforcement
	•	Extra learning mode must not break daily lesson progress.

Lesson Duration
	•	Before starting a lesson, the user must be able to choose lesson duration:
	•	10 minutes
	•	20 minutes
	•	30 minutes
	•	The selected duration must affect lesson size.
	•	The last selected duration should be stored locally.

Word Packs
	•	The app must support vocabulary packs.
	•	Each pack should be openable so the user can inspect the words inside.
	•	Users must be able to add packs.
	•	Added packs must affect lessons and the dictionary.
	•	Initial packs:
	•	Plants
	•	Animals
	•	Food
	•	Travel
	•	Home and Living
	•	Each pack should contain approximately 20 or more words.

Dictionary
	•	Dictionary filters should support:
	•	all
	•	learning
	•	known
	•	mastered
	•	difficult
	•	Users must be able to search words.
	•	Users must be able to mark a word as:
	•	“Уже знаю”
	•	Known words must not reappear as new words.

Profile and History
	•	The app must include a Profile section.
	•	Profile data should include:
	•	username
	•	total learned words
	•	mastered words
	•	difficult words
	•	current streak
	•	completed lessons
	•	Learning history should persist locally.
	•	History should include at least:
	•	date
	•	completed modules
	•	mistakes
	•	learned words

UI / UX
	•	The interface must be modern, clean, intuitive, and desktop-friendly.
	•	The home screen must clearly show:
	•	start / continue lesson
	•	extra learning
	•	dictionary
	•	packs
	•	profile
	•	progress overview
	•	The daily completion state must not feel like the app has ended.
	•	All buttons must be relevant, clickable, and connected to real actions.
	•	There must be no dead-end screens.

⸻

Technical Requirements
	•	Keep React + TypeScript + Vite + Tauri.
	•	Do not rewrite the whole project without strong reason.
	•	Reuse components where possible.
	•	Keep state management understandable.
	•	Keep strict TypeScript typing.
	•	Keep local persistence working.
	•	Ensure the app still builds successfully.

Persistence should cover:
	•	profile
	•	lesson completion
	•	lesson duration
	•	packs
	•	pack progress
	•	word statuses
	•	study history

⸻

Quality and Validation Rules
	•	Before finalizing changes, verify all visible buttons and navigation paths.
	•	Check that every visible CTA performs a real action.
	•	Ensure lesson flows work:
	•	daily lesson
	•	extra learning mode
	•	duration selection
	•	pack detail view
	•	profile history
	•	Ensure Tauri desktop build still works.
	•	Do not leave placeholder UI or pseudo-code.

⸻

Git Workflow
	•	Use git for meaningful changes.
	•	Create small logical commits.
	•	Do not rewrite git history.
	•	Do not delete previous versions.
	•	Run build validation before the final commit.

Recommended commit message styles:
	•	feat: add profile history
	•	feat: add pack detail screen
	•	feat: add post-daily extra learning mode
	•	feat: add lesson duration selection
	•	fix: connect inactive buttons
	•	ui: improve desktop navigation
	•	build: keep tauri desktop app working