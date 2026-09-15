from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = Path("output/docs/Call_Insights_Hybrid_Topic_Modeling_CTO_Brief.docx")
BLUE = "2E74B5"
DARK_BLUE = "1F4D78"
INK = "0B2545"
MUTED = "5F6B76"
LIGHT_BLUE = "E8EEF5"
LIGHT_GRAY = "F2F4F7"
PALE_BLUE = "F4F7FB"
WHITE = "FFFFFF"


def set_run_font(run, *, size: float, color: str = "000000", bold: bool = False, italic: bool = False) -> None:
    run.font.name = "Calibri"
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Calibri")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Calibri")
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    run.italic = italic


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = tc_pr.find(qn("w:shd"))
    if shading is None:
        shading = OxmlElement("w:shd")
        tc_pr.append(shading)
    shading.set(qn("w:fill"), fill)


def set_cell_margins(cell, *, top: int = 80, start: int = 120, bottom: int = 80, end: int = 120) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths_dxa: list[int]) -> None:
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths_dxa)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "120")
    tbl_ind.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_dxa:
        grid_col = OxmlElement("w:gridCol")
        grid_col.set(qn("w:w"), str(width))
        grid.append(grid_col)
    for row in table.rows:
        for index, cell in enumerate(row.cells):
            width = widths_dxa[index]
            cell.width = Inches(width / 1440)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.find(qn("w:tcW"))
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_paragraph_border(paragraph, *, color: str, size: int = 18, side: str = "left") -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    border = OxmlElement(f"w:{side}")
    border.set(qn("w:val"), "single")
    border.set(qn("w:sz"), str(size))
    border.set(qn("w:space"), "8")
    border.set(qn("w:color"), color)
    p_bdr.append(border)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    set_run_font(run, size=9, color=MUTED)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instruction = OxmlElement("w:instrText")
    instruction.set(qn("xml:space"), "preserve")
    instruction.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    value = OxmlElement("w:t")
    value.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instruction, separate, value, end])


def add_label_paragraph(document, label: str, text: str) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(4)
    label_run = paragraph.add_run(f"{label}: ")
    set_run_font(label_run, size=10.5, color=INK, bold=True)
    text_run = paragraph.add_run(text)
    set_run_font(text_run, size=10.5)


def configure_styles(document: Document) -> None:
    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
    normal.font.size = Pt(11)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.10
    for style_name, size, color, before, after in (
        ("Heading 1", 16, BLUE, 16, 8),
        ("Heading 2", 13, BLUE, 12, 6),
        ("Heading 3", 12, DARK_BLUE, 8, 4),
    ):
        style = document.styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = True
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
    list_style = document.styles["List Number"]
    list_style.font.name = "Calibri"
    list_style.font.size = Pt(11)
    list_style.paragraph_format.left_indent = Inches(0.5)
    list_style.paragraph_format.first_line_indent = Inches(-0.25)
    list_style.paragraph_format.space_after = Pt(8)
    list_style.paragraph_format.line_spacing = 1.167


def add_header_footer(document: Document) -> None:
    section = document.sections[0]
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    header.paragraph_format.space_after = Pt(0)
    run = header.add_run("CALL INSIGHTS  |  TECHNICAL BRIEF")
    set_run_font(run, size=9, color=MUTED, bold=True)
    footer = section.footer.paragraphs[0]
    add_page_number(footer)


def add_title_block(document: Document) -> None:
    kicker = document.add_paragraph()
    kicker.paragraph_format.space_before = Pt(12)
    kicker.paragraph_format.space_after = Pt(3)
    run = kicker.add_run("RECOMMENDATION FOR SPS")
    set_run_font(run, size=10, color=BLUE, bold=True)

    title = document.add_paragraph()
    title.paragraph_format.space_after = Pt(4)
    run = title.add_run("Hybrid LLM + ML Topic Modeling")
    set_run_font(run, size=24, color=INK, bold=True)

    subtitle = document.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(12)
    run = subtitle.add_run("A more accurate, evidence-grounded approach to understanding multi-issue service calls")
    set_run_font(run, size=12.5, color=MUTED)

    add_label_paragraph(document, "Prepared for", "SPS Chief Technology Officer")
    add_label_paragraph(document, "Prepared by", "Call Insights Capstone Team")
    add_label_paragraph(document, "Status", "Prototype validated on a blind synthetic benchmark; SPS pilot required")


def add_decision_callout(document: Document) -> None:
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.left_indent = Inches(0.18)
    paragraph.paragraph_format.right_indent = Inches(0.1)
    paragraph.paragraph_format.space_before = Pt(10)
    paragraph.paragraph_format.space_after = Pt(10)
    set_paragraph_border(paragraph, color=BLUE)
    lead = paragraph.add_run("Recommendation. ")
    set_run_font(lead, size=11.5, color=INK, bold=True)
    body = paragraph.add_run(
        "Use an LLM to understand and separate customer problems, ML embeddings to retrieve approved topic candidates, "
        "and a second constrained LLM decision to select or reject the topic with transcript evidence."
    )
    set_run_font(body, size=11.5, color=INK)


def add_ml_comparison(document: Document) -> None:
    document.add_heading("What We Tried First", level=1)
    paragraph = document.add_paragraph(
        "We first tested traditional machine-learning and rule-based methods on the same held-out problem statements. "
        "They were fast and useful as baselines, but paraphrases and multi-problem calls reduced reliability."
    )
    paragraph.paragraph_format.space_after = Pt(8)

    table = document.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    headers = ("Method", "Role", "Issue F1", "Multi-issue exact")
    for cell, text in zip(table.rows[0].cells, headers):
        set_cell_shading(cell, LIGHT_GRAY)
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(text)
        set_run_font(run, size=9.5, color=INK, bold=True)
    rows = (
        ("Taxonomy rules", "Interpretable baseline", "0.830", "71.4%"),
        ("Character + word TF-IDF", "Learned lexical model", "0.640", "42.9%"),
        ("LSA semantic model", "Classical semantic baseline", "0.575", "42.9%"),
        ("Existing keyphrases", "Free-form labels", "0.000", "0.0%"),
    )
    for row_index, values in enumerate(rows, start=1):
        cells = table.add_row().cells
        if row_index % 2 == 0:
            for cell in cells:
                set_cell_shading(cell, "FAFBFC")
        for cell, text in zip(cells, values):
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            run = paragraph.add_run(text)
            set_run_font(run, size=9.5)
    set_table_geometry(table, [2300, 3820, 1500, 1740])

    note = document.add_paragraph()
    note.paragraph_format.space_before = Pt(4)
    note.paragraph_format.space_after = Pt(0)
    run = note.add_run("F1 measures balanced accuracy across all topic classes. Traditional methods were given the correct segment boundaries.")
    set_run_font(run, size=8.5, color=MUTED, italic=True)


def add_hybrid_result(document: Document) -> None:
    document.add_heading("What Changed With the Hybrid Approach", level=1)
    paragraph = document.add_paragraph(
        "Codex agents then performed the LLM reasoning stage on a blind transcript-only test set. The hybrid process found "
        "the issue boundaries, interpreted each customer goal, mapped it to the stable taxonomy, and cited the supporting customer turns."
    )
    paragraph.paragraph_format.space_after = Pt(8)

    result = document.add_paragraph()
    result.paragraph_format.space_before = Pt(2)
    result.paragraph_format.space_after = Pt(6)
    set_paragraph_border(result, color=DARK_BLUE, size=14)
    run = result.add_run("Blind benchmark result: ")
    set_run_font(run, size=12, color=INK, bold=True)
    run = result.add_run("28 calls, 46 issue segments, 100% issue-count accuracy, 1.000 topic macro-F1, and 100% valid evidence turns.")
    set_run_font(run, size=12, color=INK)

    caveat = document.add_paragraph()
    caveat.paragraph_format.space_after = Pt(0)
    lead = caveat.add_run("Important limitation: ")
    set_run_font(lead, size=10.5, color="7A5A00", bold=True)
    body = caveat.add_run(
        "These are synthetic six-topic results. They validate the workflow, not production accuracy on SPS calls."
    )
    set_run_font(body, size=10.5, color="7A5A00")


def add_page_two(document: Document) -> None:
    document.add_page_break()
    document.add_heading("How the Recommended System Works", level=1)
    steps = (
        ("LLM segmentation", "Reads the full numbered transcript and separates genuinely different customer problems while keeping one long problem together."),
        ("ML retrieval", "Creates a semantic embedding for each problem and retrieves the closest approved SPS topics."),
        ("LLM reranking", "Uses the original conversation context to choose among candidates or return unknown_new_issue."),
        ("Evidence validation", "Rejects unsupported labels, overlapping spans, low-confidence decisions, and evidence outside the customer segment."),
    )
    for heading, detail in steps:
        paragraph = document.add_paragraph(style="List Number")
        label = paragraph.add_run(f"{heading}. ")
        set_run_font(label, size=11, color=INK, bold=True)
        text = paragraph.add_run(detail)
        set_run_font(text, size=11)

    document.add_heading("Why It Performs Better", level=1)
    for label, detail in (
        ("Meaning over matching", "The LLM distinguishes “payment sent but not posted” from “autopay never withdrew,” even though both mention payments and banks."),
        ("Stable business categories", "Embeddings constrain decisions to an approved taxonomy instead of creating a new phrase for every call."),
        ("Safe uncertainty", "Low-confidence or unfamiliar problems are abstained and routed to discovery and human review."),
        ("Traceability", "Every topic must point back to exact customer turns before it enters analytics or reporting."),
    ):
        add_label_paragraph(document, label, detail)

    document.add_heading("Proposed SPS Pilot", level=1)
    pilot_intro = document.add_paragraph(
        "Run the same blind evaluation inside SPS using 50–100 anonymized, human-labeled calls and the exact model intended for deployment."
    )
    pilot_intro.paragraph_format.space_after = Pt(6)
    for text in (
        "SPS provides the approved model, GPU endpoint, transcript schema, and labeling guidance.",
        "Call Insights runs both local batch and OpenAI-compatible server modes with identical structured outputs.",
        "Acceptance measures include boundary accuracy, per-topic F1, unknown-topic recall, calibration, and 100% evidence validity.",
    ):
        paragraph = document.add_paragraph(style="List Number")
        run = paragraph.add_run(text)
        set_run_font(run, size=11)

    conclusion = document.add_paragraph()
    conclusion.paragraph_format.space_before = Pt(8)
    conclusion.paragraph_format.space_after = Pt(0)
    set_paragraph_border(conclusion, color=BLUE)
    lead = conclusion.add_run("Decision requested. ")
    set_run_font(lead, size=11.5, color=INK, bold=True)
    body = conclusion.add_run(
        "Approve a small, on-premises SPS pilot before expanding UI or hologram work. The next milestone is reliable topic segmentation and evidence on real data."
    )
    set_run_font(body, size=11.5, color=INK)


def build_document() -> Path:
    document = Document()
    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.right_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    configure_styles(document)
    add_header_footer(document)
    add_title_block(document)
    add_decision_callout(document)
    add_ml_comparison(document)
    add_hybrid_result(document)
    add_page_two(document)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    print(build_document())
