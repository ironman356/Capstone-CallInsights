from pathlib import Path


DATA = [
    ("Prachi Aswani", 3000, "#1746A2"),
    ("Alexander Held", 2800, "#F9A825"),
    ("Anshul Kasera", 2700, "#2E7D32"),
    ("Abdul Hattali", 2500, "#C62828"),
]

TOTAL = sum(value for _, value, _ in DATA)

WIDTH = 1100
HEIGHT = 700
MARGIN_LEFT = 190
MARGIN_RIGHT = 80
MARGIN_TOP = 110
MARGIN_BOTTOM = 140
CHART_WIDTH = WIDTH - MARGIN_LEFT - MARGIN_RIGHT
CHART_HEIGHT = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
BAR_GAP = 42
BAR_WIDTH = (CHART_WIDTH - BAR_GAP * (len(DATA) - 1)) / len(DATA)
MAX_VALUE = 3500
Y_TICKS = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500]


def y_pos(value: int) -> float:
    usable = CHART_HEIGHT * (value / MAX_VALUE)
    return MARGIN_TOP + CHART_HEIGHT - usable


def bar_x(index: int) -> float:
    return MARGIN_LEFT + index * (BAR_WIDTH + BAR_GAP)


def make_svg() -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        '<rect width="100%" height="100%" fill="#F7F4ED" />',
        '<text x="70" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#14213D">Approximate Manual SLoC by Team Member</text>',
        f'<text x="70" y="96" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#4F5D75">Approximate handwritten code only. Total: {TOTAL:,} lines across 54 files.</text>',
    ]

    for tick in Y_TICKS:
        y = y_pos(tick)
        parts.append(
            f'<line x1="{MARGIN_LEFT}" y1="{y:.1f}" x2="{WIDTH - MARGIN_RIGHT}" y2="{y:.1f}" stroke="#D7D1C4" stroke-width="1" />'
        )
        parts.append(
            f'<text x="{MARGIN_LEFT - 18}" y="{y + 6:.1f}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#6B7280">{tick:,}</text>'
        )

    parts.append(
        f'<line x1="{MARGIN_LEFT}" y1="{MARGIN_TOP}" x2="{MARGIN_LEFT}" y2="{MARGIN_TOP + CHART_HEIGHT}" stroke="#334155" stroke-width="2" />'
    )
    parts.append(
        f'<line x1="{MARGIN_LEFT}" y1="{MARGIN_TOP + CHART_HEIGHT}" x2="{WIDTH - MARGIN_RIGHT}" y2="{MARGIN_TOP + CHART_HEIGHT}" stroke="#334155" stroke-width="2" />'
    )

    for index, (name, value, color) in enumerate(DATA):
        x = bar_x(index)
        y = y_pos(value)
        height = MARGIN_TOP + CHART_HEIGHT - y

        parts.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{BAR_WIDTH:.1f}" height="{height:.1f}" rx="12" fill="{color}" />'
        )
        parts.append(
            f'<text x="{x + BAR_WIDTH / 2:.1f}" y="{y - 12:.1f}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="700" fill="#14213D">{value:,}</text>'
        )

        label_y = MARGIN_TOP + CHART_HEIGHT + 32
        for line_index, line in enumerate(name.split(" ")):
            parts.append(
                f'<text x="{x + BAR_WIDTH / 2:.1f}" y="{label_y + line_index * 20:.1f}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#334155">{line}</text>'
            )

    parts.append("</svg>")
    return "\n".join(parts)


def main() -> None:
    out_path = Path("docs") / "team_sloc_chart.svg"
    out_path.write_text(make_svg(), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
