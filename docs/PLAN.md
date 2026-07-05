# Hackathon Planning Document

## Track 2: CleanAir & Clear Streets

### Theme

**Spotting and Fixing Local Pollution Hotspots**

---

# Problem Statement

## The Problem

City-level air quality applications often miss **hyper-local pollution events**, such as:

- Garbage dump fires
- Illegal waste burning
- Industrial smoke emissions
- Construction dust
- Smog accumulation at busy traffic junctions
- Localized pollution pockets

These events frequently go unnoticed because municipal authorities cannot monitor every street continuously, yet they directly affect nearby residents.

---

## The Challenge

Build a **neighbourhood-level pollution intelligence platform** that combines:

- Citizen-uploaded photos of smoke, dust, or pollution
- Local air quality sensor readings
- Satellite imagery

The system should automatically:

1. Detect hidden pollution hotspots
2. Predict air quality spikes over the next 24 hours
3. Alert municipal authorities
4. Recommend targeted interventions such as:
   - Water mist cannons
   - Cleanup crews
   - Inspection teams
   - Traffic diversion
   - Waste removal

The objective is to enable precise, data-driven deployment of municipal resources.

---

# Existing Project (Base Repository)

This project will **not** be built from scratch.

Instead, it will be built on top of an existing hackathon repository that was originally designed for **flood hazard detection from social media posts**.

## Existing Architecture

Current repository already contains:

- Social media ingestion
- NLP pipeline
- Noise filtering
- Deterministic scoring system
- Hazard report generation
- Mapping interface
- Backend APIs
- Database
- Dashboard
- Event visualization

### Current Logic

The existing system:

1. Collects social media posts.
2. Filters irrelevant posts using a deterministic NLP scoring algorithm.
3. Identifies genuine flood-related reports.
4. Displays validated hazards on a map.

---

# Goal

Keep as much of the existing architecture as possible.

Instead of flood hazards, tailor the system to detect and monitor:

- Smoke
- Dust
- Illegal burning
- Air pollution
- Industrial emissions
- Garbage fires

Essentially:

**Flood Intelligence Platform → Pollution Intelligence Platform**

---

# High-Level Idea

Instead of relying on only one source of information, the platform should fuse multiple data sources.

Potential inputs:

- Citizen-uploaded photos
- Social media posts
- Air quality sensors
- Weather data
- Satellite imagery
- Government datasets (later)

The platform should assign confidence scores to reports, identify clusters, detect pollution hotspots, and predict short-term air quality deterioration.

---

# Existing Features to Reuse

Keep these components with minimal changes:

- Authentication
- Backend architecture
- Database
- Dashboard
- Map visualization
- Event cards
- Report management
- NLP pipeline
- API architecture
- Scoring framework
- Deployment pipeline

Only replace flood-specific logic with pollution-specific logic.

---

# AI Opportunities

The judges specifically reward genuine AI usage.

The AI should perform meaningful work instead of acting as a decorative chatbot.

Potential AI tasks:

- Classify pollution-related text
- Analyze uploaded images
- Detect smoke
- Detect dust
- Detect fires
- Estimate severity
- Merge duplicate reports
- Cluster nearby incidents
- Predict future AQI
- Generate municipal summaries
- Explain confidence scores
- Recommend interventions

---

# Technologies to Prioritize

## AI / ML / Generative AI

Possible technologies:

- Gemini API
- Vertex AI
- Vertex AI Agents
- Vertex AI Fine-tuning
- Google AI Studio

Potential usage:

- Text understanding
- Image analysis
- Report summarization
- Severity estimation
- Recommendation generation

---

## Vision

Possible technologies:

- Gemini Multimodal
- Vertex AI Vision
- MediaPipe (if useful)

Potential usage:

- Smoke detection
- Dust detection
- Fire detection
- Garbage burning identification
- Construction pollution detection
- Vehicle smoke detection

---

## Language & Voice

Possible technologies:

- Speech-to-Text
- Text-to-Speech
- Translation API
- Dialogflow

Potential future usage:

- Voice complaint submission
- Multilingual citizen reports
- Audio alerts
- Low-literacy accessibility

---

## Geospatial

Already implemented.

Potential additions:
- Pollution heatmaps
- Hotspot clustering

---

## Mobile

Planned later.

Possible stack:

- Flutter
- Android

Potential features:

- Photo upload
- Live reporting
- GPS tagging
- Offline submission
- Push notifications

---

## Public Data

Initially use custom/demo datasets.

Later integrate:

- CPCB Air Quality Data
- IMD Weather Data
- data.gov.in
- Census data
- Other relevant government datasets

---

# Judging Criteria

## Problem-Solution Fit (20%)

Questions to satisfy:

- Does it solve the stated problem?
- Is the scope appropriate?
- Does it directly help municipalities?

---

## AI / Technical Execution (25%)

Questions to satisfy:

- Is AI performing meaningful tasks?
- Is the pipeline end-to-end?
- Is AI central to the product?

---

## Deployability & Scalability (25%)

Questions to satisfy:

- Can municipalities actually use it?
- Can it scale from one ward to an entire city?
- Is the architecture production-friendly?

---

## Inclusivity & Accessibility (15%)

Ideas:

- Voice reporting
- Multiple Indian languages
- Low-bandwidth mode
- SMS support
- WhatsApp support
- Simple UI

---

## Impact Potential (10%)

Demonstrate:

- Earlier pollution detection
- Faster municipal response
- Improved public health
- Better resource allocation

---

## Presentation & Clarity (5%)

A non-technical audience should understand:

- The problem
- The workflow
- The AI contribution
- The societal impact

within five minutes.

---

# Development Roadmap

---

# Phase 1 — Understand the Existing Repository

Goal:

Understand every component before modifying anything.

Tasks:

- Study current architecture
- Understand data flow
- Understand scoring system
- Understand NLP pipeline
- Identify flood-specific logic
- Identify reusable components
- Identify replaceable modules

Deliverable:

Architecture diagram and modification plan.

---

# Phase 2 — Convert Flood Detection into Pollution Detection

Goal:

Replace flood-specific logic with pollution-specific logic.

Tasks:

- Replace keywords
- Replace taxonomy
- Replace scoring rules
- Replace event categories
- Replace dashboard labels
- Replace report schema
- Replace map icons

Deliverable:

Working pollution-reporting system using existing deterministic pipeline.

---

# Phase 3 — Image-Based Pollution Detection

Goal:

Allow citizens to upload photos.

Tasks:

- Photo upload
- GPS extraction
- Timestamp handling
- Gemini Vision integration
- Smoke detection
- Dust detection
- Garbage fire detection
- Confidence estimation

Deliverable:

Image analysis pipeline.

---

# Phase 4 — Multi-Source Data Fusion

Goal:

Combine multiple information sources.

Inputs:

- Citizen reports
- Social media
- Image analysis
- Air quality sensors

Tasks:

- Merge duplicate reports
- Confidence aggregation
- Location clustering
- Event correlation

Deliverable:

Unified pollution event engine.

---

# Phase 5 — Hotspot Detection

Goal:

Identify pollution hotspots.

Tasks:

- Spatial clustering
- Heatmaps
- Severity calculation
- Time-based clustering
- Hotspot ranking

Deliverable:

Live pollution hotspot map.

---

# Phase 6 — Prediction

Goal:

Predict pollution over the next 24 hours.

Potential inputs:

- Historical incidents
- Weather
- Wind
- AQI
- Current reports

Outputs:

- Predicted hotspot
- Expected AQI increase
- Confidence score

Deliverable:

24-hour pollution forecast.

---

# Phase 7 — Municipal Intelligence

Goal:

Generate actionable insights.

Tasks:

Automatically recommend:

- Cleanup crew
- Water mist cannon
- Inspection
- Traffic diversion
- Waste removal
- Field verification

Deliverable:

AI-generated municipal action recommendations.

---

# Phase 8 — Accessibility

Goal:

Improve inclusivity.

Potential additions:

- Voice reporting
- Multilingual interface
- Speech-to-text
- Text-to-speech
- Translation
- Offline support

Deliverable:

Accessible citizen reporting system.

---

# Phase 9 — Government Data Integration

Goal:

Increase realism.

Potential integrations:

- CPCB AQI
- IMD Weather
- Earth Engine
- Government pollution datasets

Deliverable:

Hybrid real-world pollution intelligence platform.

---

# Phase 10 — Demo & Presentation

Deliverables:

- End-to-end demo
- Architecture diagram
- AI workflow
- Deployment architecture
- Future roadmap
- Judge presentation
- Demo script

---

# Guiding Principle

Reuse as much of the existing repository as possible.

Replace deterministic flood-specific logic with pollution-specific intelligence, then progressively enhance the platform using multimodal AI, geospatial analysis, prediction, and actionable municipal decision support.
