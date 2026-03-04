#!/usr/bin/env python3
"""
EmailShepherd — Qualification Call Deck Generator
Creates the full 10-slide discovery call deck in Google Slides.

Usage:
    python3 .claude/skills/google-slides/build_qualification_deck.py
"""

import os
import sys
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build

load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive",
]

# Brand colours
BLACK   = {"red": 0.039, "green": 0.039, "blue": 0.039}   # #0A0A0A
WHITE   = {"red": 1.0,   "green": 1.0,   "blue": 1.0}
GREY_BG = {"red": 0.969, "green": 0.969, "blue": 0.969}   # #F7F7F7
GREY_MID= {"red": 0.267, "green": 0.267, "blue": 0.267}   # #444
GREY_LT = {"red": 0.949, "green": 0.949, "blue": 0.949}   # #F2F2F2
GREY_BD = {"red": 0.894, "green": 0.894, "blue": 0.894}   # #E4E4E4
MUTED   = {"red": 0.533, "green": 0.533, "blue": 0.533}   # #888


def rgb(r, g, b):
    return {"red": r/255, "green": g/255, "blue": b/255}


def pt(n):
    """Points to EMU (1pt = 12700 EMU)"""
    return int(n * 12700)


def emu(inches):
    return int(inches * 914400)


# Slide dimensions (widescreen 16:9)
W = 9144000   # 10 inches
H = 5143500   # ~5.625 inches


def text_run(text, bold=False, size_pt=18, color=None, italic=False):
    if color is None:
        color = BLACK
    return {
        "textRun": {
            "content": text,
            "style": {
                "bold": bold,
                "italic": italic,
                "fontSize": {"magnitude": size_pt, "unit": "PT"},
                "foregroundColor": {"opaqueColor": {"rgbColor": color}},
                "fontFamily": "Inter",
            }
        }
    }


def paragraph(runs, alignment="START", space_above=0, space_below=0):
    return {
        "paragraphMarker": {
            "style": {
                "alignment": alignment,
                "spaceAbove": {"magnitude": space_above, "unit": "PT"},
                "spaceBelow": {"magnitude": space_below, "unit": "PT"},
            }
        }
    }, runs


def add_textbox(requests, page_id, text, x, y, w, h,
                bold=False, size=18, color=None, align="START",
                bg=None, italic=False):
    if color is None:
        color = BLACK
    box_id = f"box_{page_id}_{x}_{y}"
    req = [
        {"createShape": {
            "objectId": box_id,
            "shapeType": "TEXT_BOX",
            "elementProperties": {
                "pageObjectId": page_id,
                "size": {"width": {"magnitude": w, "unit": "EMU"},
                         "height": {"magnitude": h, "unit": "EMU"}},
                "transform": {"scaleX": 1, "scaleY": 1,
                              "translateX": x, "translateY": y,
                              "unit": "EMU"},
            }
        }},
        {"insertText": {"objectId": box_id, "insertionIndex": 0, "text": text}},
        {"updateTextStyle": {
            "objectId": box_id,
            "style": {
                "bold": bold,
                "italic": italic,
                "fontSize": {"magnitude": size, "unit": "PT"},
                "foregroundColor": {"opaqueColor": {"rgbColor": color}},
                "fontFamily": "Inter",
            },
            "textRange": {"type": "ALL"},
            "fields": "bold,italic,fontSize,foregroundColor,fontFamily",
        }},
        {"updateParagraphStyle": {
            "objectId": box_id,
            "style": {"alignment": align},
            "textRange": {"type": "ALL"},
            "fields": "alignment",
        }},
    ]
    if bg:
        req.append({"updateShapeProperties": {
            "objectId": box_id,
            "shapeProperties": {
                "shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": bg}}},
            },
            "fields": "shapeBackgroundFill",
        }})
    requests.extend(req)
    return box_id


def set_slide_bg(requests, page_id, color):
    requests.append({"updatePageProperties": {
        "objectId": page_id,
        "pageProperties": {
            "pageBackgroundFill": {"solidFill": {"color": {"rgbColor": color}}}
        },
        "fields": "pageBackgroundFill",
    }})


def add_rect(requests, page_id, x, y, w, h, fill_color, border_color=None):
    rect_id = f"rect_{page_id}_{x}_{y}"
    req = [{"createShape": {
        "objectId": rect_id,
        "shapeType": "RECTANGLE",
        "elementProperties": {
            "pageObjectId": page_id,
            "size": {"width": {"magnitude": w, "unit": "EMU"},
                     "height": {"magnitude": h, "unit": "EMU"}},
            "transform": {"scaleX": 1, "scaleY": 1,
                          "translateX": x, "translateY": y, "unit": "EMU"},
        }
    }}]
    props = {"shapeBackgroundFill": {"solidFill": {"color": {"rgbColor": fill_color}}}}
    fields = "shapeBackgroundFill"
    if border_color:
        props["outline"] = {"outlineFill": {"solidFill": {"color": {"rgbColor": border_color}}},
                            "weight": {"magnitude": 1, "unit": "PT"}}
        fields += ",outline"
    else:
        props["outline"] = {"propertyState": "NOT_RENDERED"}
        fields += ",outline"
    req.append({"updateShapeProperties": {
        "objectId": rect_id, "shapeProperties": props, "fields": fields
    }})
    requests.extend(req)
    return rect_id


def logo_text(requests, page_id, x, y, dark_bg=False):
    color = WHITE if dark_bg else BLACK
    add_textbox(requests, page_id, "● EmailShepherd",
                x, y, emu(2.5), pt(28), bold=True, size=13, color=color)


def slide_label(requests, page_id, label):
    add_textbox(requests, page_id, label.upper(),
                emu(8.5), pt(22), emu(1.2), pt(20),
                size=10, color=MUTED, align="END", bold=True)


def build_deck(slides_svc, drive_svc, folder_id):
    # ── Create presentation ────────────────────────────────
    f = drive_svc.files().create(
        body={"name": "EmailShepherd — Discovery Call",
              "mimeType": "application/vnd.google-apps.presentation",
              "parents": [folder_id]},
        supportsAllDrives=True,
        fields="id, webViewLink"
    ).execute()
    pid = f["id"]
    print(f"Created: {f['webViewLink']}")

    # Get default slide ID
    pres = slides_svc.presentations().get(presentationId=pid).execute()
    slides = pres["slides"]
    default_slide_id = slides[0]["objectId"]

    # ── Create 9 more slides (10 total) ────────────────────
    create_reqs = []
    slide_ids = [default_slide_id]
    for i in range(1, 10):
        sid = f"slide_{i:02d}"
        slide_ids.append(sid)
        create_reqs.append({"createSlide": {
            "objectId": sid,
            "insertionIndex": i,
            "slideLayoutReference": {"predefinedLayout": "BLANK"},
        }})

    # Delete default content from slide 1
    for el in slides[0].get("pageElements", []):
        create_reqs.append({"deleteObject": {"objectId": el["objectId"]}})

    slides_svc.presentations().batchUpdate(
        presentationId=pid, body={"requests": create_reqs}
    ).execute()

    requests = []

    # ════════════════════════════════════════════════════════
    # SLIDE 1 — TITLE (dark)
    # ════════════════════════════════════════════════════════
    s = slide_ids[0]
    set_slide_bg(requests, s, BLACK)
    logo_text(requests, s, pt(40), pt(22), dark_bg=True)

    add_textbox(requests, s, "DISCOVERY CALL",
                emu(1.0), emu(1.2), emu(5), pt(24),
                size=10, color=MUTED, bold=True)

    add_textbox(requests, s, "Let's understand\nyour world first.",
                emu(1.0), emu(1.5), emu(6), emu(1.4),
                bold=True, size=48, color=WHITE)

    add_textbox(requests, s,
                "This isn't a pitch. It's a conversation — to find out if there's a fit,\n"
                "and if there is, to agree the fastest path to knowing for certain.",
                emu(1.0), emu(3.2), emu(6.5), emu(0.8),
                size=16, color=MUTED)

    # Stats row
    stats = [("10×", "faster creation"), ("100%", "brand compliance"), ("15+", "ESP integrations")]
    for i, (num, label) in enumerate(stats):
        sx = emu(1.0) + i * emu(2.2)
        add_rect(requests, s, sx, emu(4.3), emu(2.0), emu(0.9), rgb(25,25,25), rgb(50,50,50))
        add_textbox(requests, s, num, sx + pt(20), emu(4.35), emu(1.8), pt(36),
                    bold=True, size=30, color=WHITE, align="CENTER")
        add_textbox(requests, s, label, sx + pt(20), emu(4.75), emu(1.8), pt(24),
                    size=11, color=MUTED, align="CENTER")

    # ════════════════════════════════════════════════════════
    # SLIDE 2 — THE PROCESS
    # ════════════════════════════════════════════════════════
    s = slide_ids[1]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "The Process")

    add_textbox(requests, s, "HOW WE WORK TOGETHER",
                emu(1.0), emu(0.8), emu(6), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "The path to a decision.\nYou can opt out at any point.",
                emu(1.0), emu(1.05), emu(7), emu(1.0), bold=True, size=34, color=BLACK)

    steps = [
        ("1", "Today", "Understand your setup", True),
        ("2", "Demo", "See it with your emails", False),
        ("3", "Trial Planning", "Define success together", False),
        ("4", "Trial", "2–3 weeks, real emails", False),
        ("5", "Review", "Decision based on results", False),
    ]
    for i, (num, title, sub, active) in enumerate(steps):
        sx = emu(0.8) + i * emu(1.7)
        bg = BLACK if active else GREY_LT
        tc = WHITE if active else MUTED
        add_rect(requests, s, sx + emu(0.45), emu(2.3), pt(40), pt(40), bg, GREY_BD)
        add_textbox(requests, s, num, sx + emu(0.45), emu(2.32), pt(40), pt(36),
                    bold=True, size=14, color=tc, align="CENTER")
        add_textbox(requests, s, title, sx, emu(2.85), emu(1.6), pt(28),
                    bold=True, size=13, color=BLACK, align="CENTER")
        add_textbox(requests, s, sub, sx, emu(3.1), emu(1.6), pt(36),
                    size=11, color=MUTED, align="CENTER")

    add_textbox(requests, s,
                "Target: first conversation to decision in 45–60 days. Does this shape work for you?",
                emu(1.0), emu(4.2), emu(8), pt(28), size=13, color=MUTED)

    # ════════════════════════════════════════════════════════
    # SLIDE 3 — WHAT IS EMAILSHEPHERD
    # ════════════════════════════════════════════════════════
    s = slide_ids[2]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "What We Do")

    add_textbox(requests, s, "IN 60 SECONDS",
                emu(1.0), emu(0.8), emu(4), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "The email design system built\nfor teams who build at scale.",
                emu(1.0), emu(1.05), emu(8), emu(1.0), bold=True, size=34, color=BLACK)

    cards = [
        ("Email Design System", "Modular components, full HTML control. One source of truth for every email — no code knowledge required for marketers."),
        ("Visual Editor", "Drag-and-drop for marketers. Full HTML access for developers. On-brand every time, without the bottleneck."),
        ("EmailShepherd AI", "Generate on-brand emails from a prompt. Translate instantly. Automated QA and review — without the hours."),
    ]
    for i, (title, body) in enumerate(cards):
        cx = emu(0.6) + i * emu(3.0)
        add_rect(requests, s, cx, emu(2.4), emu(2.8), emu(2.2), GREY_LT, GREY_BD)
        add_textbox(requests, s, title, cx + pt(16), emu(2.5), emu(2.6), pt(32),
                    bold=True, size=14, color=BLACK)
        add_textbox(requests, s, body, cx + pt(16), emu(2.85), emu(2.6), emu(1.4),
                    size=12, color=GREY_MID)

    # ════════════════════════════════════════════════════════
    # SLIDE 4 — WHO WE WORK WITH
    # ════════════════════════════════════════════════════════
    s = slide_ids[3]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "Who We Work With")

    add_textbox(requests, s, "TEAMS AT AN INFLECTION POINT",
                emu(1.0), emu(0.8), emu(6), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "Before I ask about your setup —\nhere's who typically comes to us.",
                emu(1.0), emu(1.05), emu(8), emu(1.0), bold=True, size=34, color=BLACK)

    cards4 = [
        ("Outgrowing their current tools", "What worked at 10 emails/month breaks at 50. Figma workarounds, ESP limitations, constant handoffs slowing the team down."),
        ("On a platform that's been acquired", "Taxi for Email was acquired twice — now it's Bird. Platform uncertainty is a real operational and commercial risk."),
        ("Scaling across teams or markets", "Multiple brands, regions, or languages. Without a single source of truth, brand consistency breaks — and legally, that matters."),
    ]
    for i, (title, body) in enumerate(cards4):
        cx = emu(0.6) + i * emu(3.0)
        add_rect(requests, s, cx, emu(2.4), emu(2.8), emu(2.2), GREY_LT, GREY_BD)
        add_textbox(requests, s, title, cx + pt(16), emu(2.5), emu(2.6), pt(32),
                    bold=True, size=14, color=BLACK)
        add_textbox(requests, s, body, cx + pt(16), emu(2.85), emu(2.6), emu(1.4),
                    size=12, color=GREY_MID)

    # ════════════════════════════════════════════════════════
    # SLIDE 5 — CURRENT SETUP DISCOVERY
    # ════════════════════════════════════════════════════════
    s = slide_ids[4]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "Your Setup")

    add_textbox(requests, s, "UNDERSTANDING YOUR WORLD",
                emu(1.0), emu(0.8), emu(6), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "Walk me through how you\nbuild an email today.",
                emu(1.0), emu(1.05), emu(8), emu(1.0), bold=True, size=38, color=BLACK)

    qs = [
        ("Volume", "How many emails per month? How many brands or markets?"),
        ("Team", "Who's involved in building an email — from brief to send?"),
        ("Tools", "What are you using today? What does the handoff look like?"),
        ("Time", "Roughly how long does one email take, end to end?"),
        ("In / Out", "What's done in-house vs agency or freelancer?"),
        ("Where it breaks", "Where does the process tend to slow down or cause friction?"),
    ]
    for i, (label, q) in enumerate(qs):
        row, col = divmod(i, 3)
        cx = emu(0.6) + col * emu(3.0)
        cy = emu(2.4) + row * emu(1.2)
        add_rect(requests, s, cx, cy, emu(2.8), emu(1.0), GREY_LT, GREY_BD)
        add_textbox(requests, s, label.upper(), cx + pt(14), cy + pt(8), emu(2.6), pt(18),
                    bold=True, size=9, color=MUTED)
        add_textbox(requests, s, q, cx + pt(14), cy + pt(22), emu(2.6), pt(40),
                    size=12, color=BLACK)

    # ════════════════════════════════════════════════════════
    # SLIDE 6 — PAINS
    # ════════════════════════════════════════════════════════
    s = slide_ids[5]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "Common Friction")

    add_textbox(requests, s, "WHAT WE TYPICALLY HEAR",
                emu(1.0), emu(0.8), emu(6), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "The friction most email teams are living with.",
                emu(1.0), emu(1.05), emu(8), pt(56), bold=True, size=34, color=BLACK)

    pains = [
        "Hours lost to manual QA — checking brand, accessibility and rendering on every email",
        "Designer bottleneck — marketers waiting on dev or design for every small change",
        "Brand inconsistency — different teams or regions not looking like the same company",
        "ESP limitations — working around what the tool can't do instead of what the brand needs",
        "Platform risk — depending on a tool that's been acquired, roadmap unclear",
    ]
    for i, pain in enumerate(pains):
        py = emu(2.1) + i * emu(0.6)
        add_rect(requests, s, emu(0.8), py, emu(8.5), emu(0.52), GREY_LT, GREY_BD)
        add_textbox(requests, s, str(i+1), emu(0.85), py + pt(6), pt(28), pt(28),
                    bold=True, size=12, color=MUTED, align="CENTER")
        add_textbox(requests, s, pain, emu(1.3), py + pt(5), emu(7.8), pt(32),
                    size=13, color=BLACK)

    # ════════════════════════════════════════════════════════
    # SLIDE 7 — CASE STUDY: BBC (split)
    # ════════════════════════════════════════════════════════
    s = slide_ids[6]
    set_slide_bg(requests, s, WHITE)

    # Left panel (dark)
    add_rect(requests, s, 0, 0, emu(3.8), H, BLACK)
    logo_text(requests, s, pt(40), pt(22), dark_bg=True)

    add_textbox(requests, s, "CASE STUDY",
                pt(40), emu(1.0), emu(3.5), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "6 brands", pt(40), emu(1.35), emu(3.5), pt(72),
                bold=True, size=52, color=WHITE)
    add_textbox(requests, s, "Rolled out across six major brands — News, Sport, iPlayer and more — in just one month.",
                pt(40), emu(2.3), emu(3.3), emu(0.6), size=13, color=MUTED)
    add_textbox(requests, s, "17 users", pt(40), emu(3.1), emu(3.5), pt(52),
                bold=True, size=36, color=WHITE)
    add_textbox(requests, s, "Zero broken code. \"Insanely fast and easy.\"",
                pt(40), emu(3.7), emu(3.3), pt(28), size=13, color=MUTED)
    add_textbox(requests, s, "BBC  ·  Media & Publishing",
                pt(40), emu(4.6), emu(3.5), pt(24), size=11, color=MUTED, bold=True)

    # Right panel
    slide_label(requests, s, "Case Study")
    add_textbox(requests, s, "BEFORE & AFTER",
                emu(4.1), emu(0.8), emu(4), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "From \"messy and high-risk\"\nto \"insanely fast\"",
                emu(4.1), emu(1.05), emu(5.5), emu(0.9), bold=True, size=26, color=BLACK)

    before = ["HTML edited manually in ESP editor", "Broken, bloated code on every send",
              "Approval via multiple email threads", "Comments missed, feedback conflicting",
              "Manual link tracking — error-prone"]
    after  = ["Process described as \"insanely fast\"", "Zero broken code",
              "Centralised approvals — like Google Docs", "Tag colleagues directly in the design",
              "100% accurate link tracking, automated"]

    add_textbox(requests, s, "BEFORE", emu(4.1), emu(2.2), emu(2.3), pt(18),
                bold=True, size=9, color=MUTED)
    add_textbox(requests, s, "AFTER", emu(6.6), emu(2.2), emu(2.3), pt(18),
                bold=True, size=9, color=BLACK)

    for i, (b, a) in enumerate(zip(before, after)):
        py = emu(2.45) + i * emu(0.46)
        add_rect(requests, s, emu(4.1), py, emu(2.3), emu(0.4), GREY_LT, GREY_BD)
        add_textbox(requests, s, b, emu(4.15), py + pt(5), emu(2.2), pt(36),
                    size=11, color=GREY_MID)
        add_rect(requests, s, emu(6.6), py, emu(2.3), emu(0.4), GREY_LT, GREY_BD)
        add_textbox(requests, s, a, emu(6.65), py + pt(5), emu(2.2), pt(36),
                    size=11, color=BLACK)

    # ════════════════════════════════════════════════════════
    # SLIDE 8 — CASE STUDY: RETAILER (split)
    # ════════════════════════════════════════════════════════
    s = slide_ids[7]
    set_slide_bg(requests, s, WHITE)

    add_rect(requests, s, 0, 0, emu(3.8), H, BLACK)
    logo_text(requests, s, pt(40), pt(22), dark_bg=True)

    add_textbox(requests, s, "CASE STUDY",
                pt(40), emu(1.0), emu(3.5), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "2 weeks\n→ 1 day", pt(40), emu(1.35), emu(3.5), emu(1.0),
                bold=True, size=44, color=WHITE)
    add_textbox(requests, s, "Lead time slashed from a two-week agency cycle to a 24-hour in-house turnaround.",
                pt(40), emu(2.6), emu(3.3), emu(0.6), size=13, color=MUTED)
    add_textbox(requests, s, "Real-time", pt(40), emu(3.35), emu(3.5), pt(52),
                bold=True, size=36, color=WHITE)
    add_textbox(requests, s, "Emails auto-populated from live data feeds. Sell specific products at today's prices.",
                pt(40), emu(3.95), emu(3.3), emu(0.6), size=13, color=MUTED)
    add_textbox(requests, s, "Major Online Retailer  ·  eCommerce",
                pt(40), emu(4.6), emu(3.5), pt(24), size=11, color=MUTED, bold=True)

    slide_label(requests, s, "Case Study")
    add_textbox(requests, s, "BEFORE & AFTER",
                emu(4.1), emu(0.8), emu(4), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "From slow and agency-dependent\nto real-time and in-house",
                emu(4.1), emu(1.05), emu(5.5), emu(0.9), bold=True, size=26, color=BLACK)

    before2 = ["2-week agency turnaround", "Forced to sell generic categories",
               "Prices expired before email sent", "No ability to react to competitors",
               "Agency retainer + rush fees"]
    after2  = ["24-hour in-house turnaround", "Selling specific products at live prices",
               "Live data feed auto-populates emails", "React to the market in real-time",
               "Agency removed. Revenue up immediately."]

    add_textbox(requests, s, "BEFORE", emu(4.1), emu(2.2), emu(2.3), pt(18),
                bold=True, size=9, color=MUTED)
    add_textbox(requests, s, "AFTER", emu(6.6), emu(2.2), emu(2.3), pt(18),
                bold=True, size=9, color=BLACK)

    for i, (b, a) in enumerate(zip(before2, after2)):
        py = emu(2.45) + i * emu(0.46)
        add_rect(requests, s, emu(4.1), py, emu(2.3), emu(0.4), GREY_LT, GREY_BD)
        add_textbox(requests, s, b, emu(4.15), py + pt(5), emu(2.2), pt(36),
                    size=11, color=GREY_MID)
        add_rect(requests, s, emu(6.6), py, emu(2.3), emu(0.4), GREY_LT, GREY_BD)
        add_textbox(requests, s, a, emu(6.65), py + pt(5), emu(2.2), pt(36),
                    size=11, color=BLACK)

    # ════════════════════════════════════════════════════════
    # SLIDE 9 — TRIAL SETUP QUESTIONS
    # ════════════════════════════════════════════════════════
    s = slide_ids[8]
    set_slide_bg(requests, s, WHITE)
    logo_text(requests, s, pt(40), pt(22))
    slide_label(requests, s, "Before We Close")

    add_textbox(requests, s, "FOUR QUESTIONS",
                emu(1.0), emu(0.8), emu(4), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "A few things that shape\nhow we move forward.",
                emu(1.0), emu(1.05), emu(8), emu(1.0), bold=True, size=38, color=BLACK)

    qs9 = [
        ("The Right Room", "Who else on your team would you want in the room for a proper demo?"),
        ("Stakeholders", "Who would need to see trial results to feel confident recommending this?"),
        ("Success Criteria", "What would the trial need to demonstrate for it to be a clear yes?"),
        ("Decision Process", "How does a decision like this typically get made — and who signs off?"),
    ]
    for i, (label, q) in enumerate(qs9):
        row, col = divmod(i, 2)
        cx = emu(0.7) + col * emu(4.5)
        cy = emu(2.5) + row * emu(1.3)
        add_rect(requests, s, cx, cy, emu(4.1), emu(1.1), GREY_LT, GREY_BD)
        add_textbox(requests, s, label.upper(), cx + pt(16), cy + pt(10), emu(3.9), pt(18),
                    bold=True, size=9, color=MUTED)
        add_textbox(requests, s, q, cx + pt(16), cy + pt(25), emu(3.9), pt(52),
                    bold=True, size=14, color=BLACK)

    # ════════════════════════════════════════════════════════
    # SLIDE 10 — NEXT STEPS (dark)
    # ════════════════════════════════════════════════════════
    s = slide_ids[9]
    set_slide_bg(requests, s, BLACK)
    logo_text(requests, s, pt(40), pt(22), dark_bg=True)

    add_textbox(requests, s, "WHAT HAPPENS NEXT",
                emu(1.0), emu(0.8), emu(5), pt(20), size=10, color=MUTED, bold=True)
    add_textbox(requests, s, "Let's agree on the next step.",
                emu(1.0), emu(1.05), emu(8), pt(60), bold=True, size=40, color=WHITE)

    steps10 = [
        ("✓", "Today — Discovery", "Understand your current setup and challenges", "Done", True),
        ("2", "Demo Call", "45 min · your team · your email types · right people in the room", "~Week 2", False),
        ("3", "Trial Planning", "Define success criteria · get decision-maker involved", "~Week 3", False),
        ("4", "Trial → Review → Decision", "2–3 week trial · review against agreed criteria · you decide", "Weeks 4–8", False),
    ]
    for i, (num, title, detail, timing, active) in enumerate(steps10):
        py = emu(2.15) + i * emu(0.72)
        bg = rgb(25,25,25) if not active else rgb(50,50,50)
        add_rect(requests, s, emu(0.8), py, emu(8.3), emu(0.62), bg)
        add_textbox(requests, s, num, emu(0.85), py + pt(8), pt(36), pt(36),
                    bold=True, size=12, color=MUTED if not active else WHITE, align="CENTER")
        add_textbox(requests, s, title, emu(1.35), py + pt(6), emu(5.5), pt(26),
                    bold=True, size=13, color=WHITE if active else rgb(180,180,180))
        add_textbox(requests, s, detail, emu(1.35), py + pt(26), emu(5.5), pt(22),
                    size=11, color=MUTED)
        add_textbox(requests, s, timing, emu(7.5), py + pt(12), emu(1.4), pt(24),
                    size=12, color=MUTED, align="END")

    add_textbox(requests, s, "What does your diary look like next week?",
                emu(1.0), emu(5.0), emu(8), pt(32), size=18, color=MUTED, align="CENTER")

    # ── Send all requests ──────────────────────────────────
    BATCH = 50
    for i in range(0, len(requests), BATCH):
        slides_svc.presentations().batchUpdate(
            presentationId=pid,
            body={"requests": requests[i:i+BATCH]}
        ).execute()
        print(f"  Batch {i//BATCH + 1} done ({min(i+BATCH, len(requests))}/{len(requests)} requests)")

    print(f"\nDone! Open your deck:\n{f['webViewLink']}")
    return f['webViewLink']


def main():
    load_dotenv()
    creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", ".google-credentials.json")
    folder_id  = os.getenv("EMAILSHEPHERD_DRIVE_FOLDER_ID")

    if not folder_id:
        print("ERROR: EMAILSHEPHERD_DRIVE_FOLDER_ID not set in .env")
        sys.exit(1)

    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    slides_svc = build("slides", "v1", credentials=creds)
    drive_svc  = build("drive",  "v3", credentials=creds)

    build_deck(slides_svc, drive_svc, folder_id)


if __name__ == "__main__":
    main()
