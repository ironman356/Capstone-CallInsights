$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot '..\output\docs'
$outPath = Join-Path $outDir 'Call_Insights_CTO_One_Pager.docx'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$section = $doc.Sections.Item(1)
$section.PageSetup.TopMargin = $word.InchesToPoints(0.45)
$section.PageSetup.BottomMargin = $word.InchesToPoints(0.45)
$section.PageSetup.LeftMargin = $word.InchesToPoints(0.62)
$section.PageSetup.RightMargin = $word.InchesToPoints(0.62)

function Add-Line {
    param(
        [string]$Text,
        [double]$Size = 9.5,
        [string]$Color = '18212B',
        [bool]$Bold = $false,
        [double]$Before = 0,
        [double]$After = 3,
        [int]$Align = 0,
        [string]$Shade = '',
        [string]$LeftBorder = ''
    )
    $range = $doc.Range($doc.Content.End - 1, $doc.Content.End - 1)
    $range.InsertAfter($Text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count)
    $p.Range.Font.Name = 'Arial'
    $p.Range.Font.Size = $Size
    $p.Range.Font.Bold = $(if ($Bold) { 1 } else { 0 })
    $p.Range.Font.Color = [int]('0x' + $Color.Substring(4,2) + $Color.Substring(2,2) + $Color.Substring(0,2))
    $p.Format.SpaceBefore = $Before
    $p.Format.SpaceAfter = $After
    $p.Format.LineSpacingRule = 0
    $p.Alignment = $Align
    if ($Shade) { $p.Range.Shading.BackgroundPatternColor = [int]('0x' + $Shade.Substring(4,2) + $Shade.Substring(2,2) + $Shade.Substring(0,2)) }
    if ($LeftBorder) {
        $b = $p.Borders.Item(-2)
        $b.LineStyle = 1
        $b.LineWidth = 6
        $b.Color = [int]('0x' + $LeftBorder.Substring(4,2) + $LeftBorder.Substring(2,2) + $LeftBorder.Substring(0,2))
    }
}

function Add-MixedLine {
    param([string]$Label, [string]$Text)
    $range = $doc.Range($doc.Content.End - 1, $doc.Content.End - 1)
    $range.InsertAfter($Label + ' ' + $Text + "`r")
    $p = $doc.Paragraphs.Item($doc.Paragraphs.Count)
    $p.Range.Font.Name = 'Arial'; $p.Range.Font.Size = 9.3
    $p.Range.Font.Color = 0x2B2118
    $p.Format.SpaceAfter = 2; $p.Format.LineSpacingRule = 0
}

Add-Line 'CALL INSIGHTS  /  CTO DISCUSSION' 8 '536170' $true 0 1
Add-Line 'ONE-PAGE PROJECT UPDATE' 8.5 '2E74B5' $true 0 2
Add-Line 'Finding the Agent Approaches That Work' 22 '17324D' $true 0 2
Add-Line 'Simple goal: for the same customer problem, show which agent approaches lead to better outcomes and why.' 10.4 '536170' $false 0 6
Add-Line 'We are not trying to make another dashboard. We are building the analysis underneath it: a way to spot useful explanations, phrases, and analogies that are currently buried across thousands of calls.' 10 '18212B' $false 0 6 0 'EAF5F3' '237B7B'

Add-Line 'What the system does' 10.6 '17324D' $true 4 2
Add-Line 'CALL TRANSCRIPT  ->  SEPARATE CUSTOMER PROBLEMS  ->  FIND THE AGENT''S APPROACH  ->  CHECK THE OUTCOME  ->  COMPARE SIMILAR CASES' 8.2 '17324D' $true 0 3 1 'EEF5FB'
Add-Line 'Example: two customers may both call about escrow. One agent gives a step-by-step explanation, while another only repeats a policy. We compare those approaches within the same problem instead of mixing unrelated calls.' 9.2 '18212B' $false 0 2

Add-Line 'What we tested' 10.6 '17324D' $true 4 2
Add-MixedLine 'Traditional ML:' 'rules, TF-IDF, and older semantic models. They are fast and useful for a baseline, but wording changes and multi-problem calls are hard for them.'
Add-MixedLine 'Hybrid LLM + ML:' 'the LLM reads the conversation and finds the separate problems; ML retrieves approved topic options; the LLM chooses from those options and must point to the customer turns that support the decision.'
Add-MixedLine 'Safety checks:' 'if the system is unsure or sees a new type of issue, it says so instead of forcing a bad label. New clusters stay in review until a person approves them.'

Add-Line 'Why the hybrid approach is the direction we recommend' 10.6 '17324D' $true 4 2
Add-Line 'CONTEXT  +  CONSISTENCY  +  PROOF' 9.5 '17324D' $true 0 2 1 'FFF7E6'
Add-Line 'The LLM understands different wording, analogies, and calls with more than one issue. The ML layer keeps reporting tied to stable business categories. Evidence-turn checks let a manager open the exact part of the call behind a result.' 9.2 '18212B' $false 0 2

Add-Line 'Early results - promising, but not an SPS claim' 10.6 '17324D' $true 4 2
Add-Line 'On a blind synthetic test, the hybrid workflow found 46 issue segments across 28 calls and matched the known topic sequence correctly. The best traditional baseline reached 0.83 macro-F1 when it was already given the correct issue boundaries.' 9.2 '18212B' $false 0 2
Add-Line 'Important: this proves the workflow on our test data, not that it is production-ready. The next real test is 50-100 anonymized SPS calls labeled by reviewers.' 8.8 '7A5A00' $true 0 2 0 '' 'C78C1B'

Add-Line 'What this can help management find' 10.6 '17324D' $true 4 2
Add-Line '- A phrase or analogy used by only a few agents that gets a better result`r- Which approaches work across many agents versus only for certain agents`r- What makes an approach effective: timing, clarity, empathy, a specific explanation, or a next step`r- Real examples with counts and uncertainty, not just a black-box score' 9 '18212B' $false 0 3

Add-Line 'Decisions and help we need from SPS' 10.6 '17324D' $true 4 2
Add-Line '1. A small anonymized, human-labeled call sample for evaluation.   2. Guidance on the approved GPU/server setup and local model options.   3. Confirmation of any internal practices or language that should not appear in a demo.' 9.2 '18212B' $false 0 0

$doc.SaveAs2([string]$outPath, 16)
$doc.Close()
$word.Quit()
Write-Output $outPath
