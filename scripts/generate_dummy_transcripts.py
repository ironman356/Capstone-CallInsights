from __future__ import annotations

import argparse
import random
from pathlib import Path


ISSUES = [
    {
        "label": "payment posting confusion",
        "customer_openers": [
            "my payment still shows pending even though I made it online three days ago",
            "I made a payment this week and the website is still not showing it as posted",
            "my payment came out of my bank, but on your side it still looks like nothing happened",
        ],
        "agent_checks": [
            "I am looking at the recent payment activity now, including the scheduled and posted dates.",
            "I can see the transaction you are referring to, so let me walk through the timing with you.",
            "I am reviewing the payment history on the loan right now.",
        ],
        "agent_explanations": [
            "online payments can show as pending before they finish posting to the monthly billing history",
            "the draft may already be in progress even if the website has not refreshed to posted yet",
            "there can be a short delay between the bank withdrawal and the loan servicing update",
        ],
        "customer_concerns": [
            "I just do not want that to turn into a late fee.",
            "My concern is I do not want this to show me past due when I already paid it.",
            "I am trying to avoid another call about the same payment.",
        ],
        "resolutions": [
            "I do see the payment in process, and I do not see a late fee tied to it right now.",
            "What I can do today is note the account and submit a posting review so it is documented.",
            "If it has not updated by the next business day, we can escalate the posting review from here.",
        ],
    },
    {
        "label": "escrow shortage",
        "customer_openers": [
            "I got a letter about an escrow shortage and I do not understand why my payment jumped",
            "my monthly payment went up and the letter says it has to do with escrow",
            "I need somebody to explain this escrow analysis because the amount looks way higher than I expected",
        ],
        "agent_checks": [
            "I have the escrow analysis in front of me now.",
            "I am reviewing the breakdown from the most recent escrow review.",
            "I can see the projected escrow activity and the new payment amount on my side.",
        ],
        "agent_explanations": [
            "the escrow review shows a higher projected disbursement for taxes or insurance than last year",
            "the shortage means there was not enough in the escrow balance to cover the projected bills",
            "part of the increase is catching up the shortage and part is setting the new monthly escrow amount",
        ],
        "customer_concerns": [
            "I was not expecting my payment to go up this much all at once.",
            "That is the part I am struggling with because nothing else changed on my end.",
            "I need to know whether this is temporary or my regular payment now.",
        ],
        "resolutions": [
            "I can break down the shortage amount line by line and explain when the new payment takes effect.",
            "If you want, I can tell you what portion is principal and interest versus escrow.",
            "I will also note the account so you have a record that we reviewed the escrow analysis today.",
        ],
    },
    {
        "label": "late fee dispute",
        "customer_openers": [
            "I need to understand why there is a late fee on my account",
            "I do not think that late fee should be there because I made the payment as soon as I could",
            "I was charged a late fee and I am calling because I do not believe it is correct",
        ],
        "agent_checks": [
            "Let me review the due date, grace period, and when the payment actually posted.",
            "I am checking the timeline on the last payment and the fee assessment now.",
            "I have the billing cycle details up, so give me just a moment.",
        ],
        "agent_explanations": [
            "late fees are typically based on when the payment posts after the grace period",
            "the system applies the late fee when the required amount is not posted by the end of the grace window",
            "sometimes the fee looks sudden, but it is tied to the posting date rather than when the payment was initiated",
        ],
        "customer_concerns": [
            "I just want somebody to look at the timeline fairly.",
            "That still feels wrong to me because I was trying to make the payment before it got worse.",
            "I am asking if there is any way to review this instead of just telling me it stays.",
        ],
        "resolutions": [
            "If the history supports it, I can submit a courtesy waiver request for review.",
            "What I can confirm today is whether the fee was assessed according to the account timeline.",
            "If needed, I can transfer you to a supervisor after I finish documenting what we reviewed.",
        ],
    },
    {
        "label": "autopay not applied",
        "customer_openers": [
            "I was told autopay would come out automatically and it never drafted",
            "my automatic payment did not pull this month and now I am worried I will be marked late",
            "I enrolled in autopay, but nothing came out of my bank account",
        ],
        "agent_checks": [
            "I am checking the autopay enrollment date and the draft schedule now.",
            "Let me review whether the bank account was active in time for this month's draft.",
            "I can see the autopay profile, so I am looking at when it became effective.",
        ],
        "agent_explanations": [
            "autopay usually starts on the next eligible cycle after enrollment is fully active",
            "if the enrollment completed after the monthly cutoff, the current payment may still need to be made manually",
            "the bank information can be saved successfully even when the first draft has not started yet",
        ],
        "customer_concerns": [
            "That was not how it was explained to me when I signed up.",
            "I signed up because I did not want to risk missing the payment.",
            "I need to know what I have to do today so this does not get worse.",
        ],
        "resolutions": [
            "I can confirm whether autopay is set for the next cycle and explain what to do for the current due date.",
            "If you want, I can go over the manual payment options for this month while autopay finishes setting up.",
            "I will document the account so there is a record that the autopay start date was reviewed with you.",
        ],
    },
    {
        "label": "payoff quote request",
        "customer_openers": [
            "I need a payoff amount because we are getting ready to close",
            "my title company asked me to get the payoff request moving today",
            "I am trying to get the payoff quote and I want to make sure I do it the right way",
        ],
        "agent_checks": [
            "I can explain the payoff request steps and turnaround from here.",
            "Let me review what information is needed for the payoff quote.",
            "I am checking the process we use for payoff statements now.",
        ],
        "agent_explanations": [
            "payoff quotes are issued through a request process and are valid through a specific good-through date",
            "the amount changes by day because of interest, so the payoff has to match the closing timeline",
            "the statement will usually include the unpaid principal, interest, and any applicable fees through the requested date",
        ],
        "customer_concerns": [
            "I just do not want this to delay closing.",
            "We are on a timeline, so I need to know how fast this can be turned around.",
            "I want to make sure the title company gets exactly what it needs.",
        ],
        "resolutions": [
            "I can give you the request path and the normal turnaround so you know what to expect.",
            "If you already have a closing date, I can explain why the good-through date matters.",
            "I will note the account that you called about the payoff today in case the request team needs context.",
        ],
    },
    {
        "label": "hardship or forbearance question",
        "customer_openers": [
            "I am trying to avoid another missed payment and I need to know what hardship options are available",
            "my income dropped and I am calling to ask about forbearance or any temporary help",
            "I need to understand what kind of assistance might be available because I am falling behind",
        ],
        "agent_checks": [
            "I can go over the general assistance process and what the review usually requires.",
            "Let me explain the hardship review path we have for situations like this.",
            "I am pulling up the assistance information so I can give you accurate next steps.",
        ],
        "agent_explanations": [
            "available options depend on the account status and a formal review by the assistance team",
            "the hardship process usually requires supporting information before an option can be offered",
            "forbearance or repayment help is not quoted directly on this line, but I can explain how the review starts",
        ],
        "customer_concerns": [
            "I am not trying to ignore the loan, I just need a path forward.",
            "I want to handle this before I miss another payment.",
            "I am stressed and I just need to know what to do next.",
        ],
        "resolutions": [
            "I can outline the next steps and tell you what to expect from the assistance review.",
            "If needed, I can transfer you to the team that handles hardship intake after I note the account.",
            "I will document that you called proactively about assistance so the next team sees that context.",
        ],
    },
    {
        "label": "loan statement confusion",
        "customer_openers": [
            "my monthly statement does not make sense and I cannot tell what I am actually supposed to pay",
            "I am looking at this statement and the amounts do not add up to me",
            "I already called about this statement once and I am still confused by the breakdown",
        ],
        "agent_checks": [
            "I have the statement image and balance details in front of me now.",
            "Let me go line by line through what is listed on that statement.",
            "I am reviewing the billed amount, unpaid charges, and escrow line now.",
        ],
        "agent_explanations": [
            "the statement can include the regular monthly payment plus any outstanding charges from a prior cycle",
            "the total due may reflect principal, interest, escrow, and fees shown in separate sections",
            "the amount that feels off is often tied to unpaid charges or the escrow portion of the bill",
        ],
        "customer_concerns": [
            "That is exactly what I could not tell from reading it by myself.",
            "I need it explained in plain language because the statement wording is not clear to me.",
            "I was worried I was reading the wrong amount and about to pay the wrong thing.",
        ],
        "resolutions": [
            "I can break each section down so you know which amount is the regular payment and which is separate.",
            "If it still does not look right after we review it, I can note it for additional research.",
            "I can also explain what amount would bring the loan current based on what I am seeing.",
        ],
    },
    {
        "label": "insurance proof or tax escrow issue",
        "customer_openers": [
            "I already sent in my insurance information and I want to know why the account still shows an issue",
            "I got another notice about insurance even though I thought I already provided proof",
            "I have a question about the insurance documents and whether they were matched to my loan",
        ],
        "agent_checks": [
            "I am reviewing the insurance tracking notes on the account now.",
            "Let me check whether proof of coverage has been received and updated.",
            "I can see the escrow and insurance tracking information from here.",
        ],
        "agent_explanations": [
            "sometimes the coverage is received but still pending review before the system updates",
            "the notice can continue until the declaration page is matched and the review is completed",
            "there can be a delay between document receipt and the escrow record showing cleared",
        ],
        "customer_concerns": [
            "I do not want to keep getting notices if I already did what I was supposed to do.",
            "That is why I am calling, because I do not want a force-placed policy issue on top of this.",
            "I just need to know if you actually have what you need from me.",
        ],
        "resolutions": [
            "I can tell you what documents appear on file and whether anything else is still needed.",
            "If the documents were previously sent, I can note that and route it for review.",
            "I will explain the next step so you know whether to resend anything or wait for the update.",
        ],
    },
    {
        "label": "payment plan request",
        "customer_openers": [
            "I fell behind and I need to know whether there is any kind of payment plan",
            "I want to see if there is a way to catch up over time instead of one large payment",
            "can somebody tell me if partial payments or a repayment plan are possible on my loan",
        ],
        "agent_checks": [
            "I can explain the review process for repayment options from here.",
            "Let me go over what usually determines whether a payment plan can be offered.",
            "I am checking the delinquency status so I can explain the next step accurately.",
        ],
        "agent_explanations": [
            "repayment options depend on the delinquency status and the review completed by the assistance team",
            "partial payments alone do not always create a formal plan unless the account is approved for one",
            "there is usually an intake and review before specific terms are discussed",
        ],
        "customer_concerns": [
            "I am trying to be proactive instead of letting this snowball.",
            "I know I cannot fix everything today, but I need to understand my options.",
            "I just need something that feels manageable.",
        ],
        "resolutions": [
            "I can explain the intake path and what information the repayment review team will need.",
            "If appropriate, I can transfer you after I note the account with today's conversation.",
            "I will make sure the account reflects that you are asking for a way to catch up, not ignoring the balance.",
        ],
    },
    {
        "label": "call transfer or hold friction",
        "customer_openers": [
            "this is the second time I have called and I keep getting transferred around",
            "I was on hold earlier and then the call disconnected, so I really do not want to start over",
            "nobody seems to know where this issue belongs and I am getting frustrated",
        ],
        "agent_checks": [
            "I am reading through the prior notes first so you do not have to repeat everything.",
            "Let me see how far I can take this from my side before moving you anywhere else.",
            "I can review the last contact notes and explain what the next best team would be if needed.",
        ],
        "agent_explanations": [
            "I want to avoid another blind transfer, so I am checking the account history before I advise next steps",
            "some issues do require a specialized team, but I can set expectations clearly before that happens",
            "if I do need to route the call, I will document the issue so you are not starting from zero again",
        ],
        "customer_concerns": [
            "I appreciate that, because I have already explained this more than once today.",
            "That is all I am asking for, just do not make me repeat the whole story again.",
            "I am already frustrated, so I need a clear answer on what happens next.",
        ],
        "resolutions": [
            "I will stay on the line as long as I can and make sure the notes are complete first.",
            "If a transfer is still needed, I can explain exactly why and what that team will handle.",
            "I am documenting the prior hold and transfer issue so the account history is clear.",
        ],
    },
]

VERIFICATION_LINES = [
    "Before I discuss the loan, I do need to complete a quick verification.",
    "I can help with that. First I need to complete a brief verification on the account.",
    "Absolutely. Let me verify the account with you first and then we will go through it together.",
]

VERIFICATION_RESPONSES = [
    "Okay, that is fine.",
    "Sure, go ahead.",
    "That is fine, I can do that.",
]

EMPATHY_LINES = [
    "I understand why that would be frustrating.",
    "I can hear the concern, and I will walk through it carefully with you.",
    "I understand this is stressful, and I will explain what I am seeing as clearly as I can.",
]

FOLLOW_UP_LINES = [
    "I am also adding detailed notes so the account reflects what we reviewed today.",
    "I will summarize the next steps before we end the call so nothing is unclear.",
    "Let me make sure I explain what happens next and what timeframe to expect.",
]

OUTCOME_ENDINGS = {
    "resolved": [
        [
            "Customer: Okay, that makes more sense now.",
            "Customer: I appreciate you taking the time to explain it.",
            "Agent: Of course. I am glad we could clear that up today.",
        ],
        [
            "Customer: All right, I understand what happened now.",
            "Agent: I know it can be confusing, but I am glad we were able to go through it together.",
            "Customer: Thank you. That answers my question.",
        ],
    ],
    "unresolved": [
        [
            "Customer: I still do not feel like this is fully resolved.",
            "Agent: I understand. What I can do today is document everything we reviewed and note the remaining concern.",
            "Customer: Okay. I just do not want this to be dropped.",
        ],
        [
            "Customer: I hear what you are saying, but I am still not comfortable with where this stands.",
            "Agent: That is fair, and I will note that the issue is still open from your perspective.",
            "Customer: All right. I will wait for the next update.",
        ],
    ],
    "escalated": [
        [
            "Customer: At this point I really think I need a supervisor or the other team involved.",
            "Agent: I understand. I will document what we covered and get you to the correct escalation path.",
            "Customer: Okay. Please make sure they can see the notes.",
        ],
        [
            "Customer: I do not want to start over again with another person.",
            "Agent: I understand, and I am adding detailed notes before I transfer or escalate this further.",
            "Customer: All right. That is what I was worried about.",
        ],
    ],
    "follow-up needed": [
        [
            "Agent: This one still needs additional review on our side.",
            "Customer: Okay, so I should wait for the update before calling back again?",
            "Agent: Yes. I am noting the account for follow-up so the review is already in motion.",
        ],
        [
            "Agent: I do not want to guess at the answer while the review is still pending.",
            "Customer: That makes sense. I just wanted to know what happens from here.",
            "Agent: The next step is the follow-up review, and I am documenting that now.",
        ],
    ],
    "callback requested": [
        [
            "Customer: Once someone has the full answer, I would rather get a callback than keep checking.",
            "Agent: That is completely fine. I will note that a callback was requested after the review is completed.",
            "Customer: Thank you. That would help a lot.",
        ],
        [
            "Customer: Can somebody call me back once the research is done?",
            "Agent: Yes. I will document the callback request with the account notes today.",
            "Customer: All right. I appreciate that.",
        ],
    ],
}


def clean_sentence(value: str) -> str:
    value = value.strip()
    if value.endswith("."):
        value = value[:-1]
    return value


def build_transcript(index: int, issue: dict[str, list[str] | str], rng: random.Random) -> str:
    outcome = rng.choice(list(OUTCOME_ENDINGS.keys()))
    opener = rng.choice(issue["customer_openers"])
    agent_check = rng.choice(issue["agent_checks"])
    explanation = clean_sentence(rng.choice(issue["agent_explanations"]))
    concern = rng.choice(issue["customer_concerns"])
    resolution = rng.choice(issue["resolutions"])
    verification = rng.choice(VERIFICATION_LINES)
    verification_response = rng.choice(VERIFICATION_RESPONSES)
    empathy = rng.choice(EMPATHY_LINES)
    follow_up = rng.choice(FOLLOW_UP_LINES)

    lines = [
        "Agent: Thank you for calling SPS mortgage servicing. My name is Taylor. How can I help you today?",
        f"Customer: Hi, {opener}.",
        f"Agent: {verification}",
        f"Customer: {verification_response}",
        "Agent: Thank you. I have the account in front of me now.",
        f"Agent: {agent_check}",
        f"Customer: {concern}",
        f"Agent: {empathy}",
        f"Agent: What I am seeing is that {explanation}.",
        "Customer: Okay, but that was not clear from what I saw online.",
    ]

    if index % 5 == 0:
        lines.extend(
            [
                "Customer: I already called once about this, so I am trying not to go in circles again.",
                "Agent: I understand, and I will be as specific as I can so you know exactly what this means.",
            ]
        )

    if index % 7 == 0:
        lines.extend(
            [
                "Customer: I was on hold earlier today, so I really do not want to get bounced around again.",
                "Agent: I understand. I will keep the notes detailed so you do not have to repeat yourself if another team is needed.",
            ]
        )

    lines.extend(
        [
            "Agent: Let me walk through what that means for the payment, due date, and next step.",
            f"Agent: {resolution}",
            f"Agent: {follow_up}",
        ]
    )

    lines.extend(rng.choice(OUTCOME_ENDINGS[outcome]))
    lines.extend(
        [
            "Agent: Thank you for calling today.",
            "Customer: Thank you.",
        ]
    )

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate realistic dummy mortgage servicing transcript files.")
    parser.add_argument("--count", type=int, default=50, help="Number of transcript files to generate.")
    parser.add_argument("--out", type=Path, default=Path("data/raw/transcripts"), help="Output directory.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for repeatable output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)
    for index in range(1, args.count + 1):
        issue = ISSUES[(index - 1) % len(ISSUES)]
        transcript = build_transcript(index=index, issue=issue, rng=rng)
        file_path = args.out / f"transcript_{index:03d}.txt"
        file_path.write_text(transcript, encoding="utf-8")


if __name__ == "__main__":
    main()
