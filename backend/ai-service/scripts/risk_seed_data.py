"""
Seed/bootstrap training data for the ML risk classifier (RandomForest/XGBoost layer —
see train_risk_classifier.py and app/services/ml_risk.py).

*** THIS IS A HAND-WRITTEN SEED SET, NOT A VALIDATED CLINICAL DATASET. ***
~180 short examples across 3 classes is enough to demo a genuinely-trained classifier
as a third detection layer, and to show the XGBoost/RandomForest evaluation-and-pick
workflow on the architecture slide — it is NOT enough to trust in a real deployment.
Before this app is used by real people, replace this with a properly sourced,
clinically-reviewed, much larger dataset (and get an ethics/clinical review of the
whole risk pipeline, not just this file).

Labels:
  none     — everyday conversation, no distress signal
  medium   — ordinary stress/sadness/anxiety — worth a warmer, more attentive reply,
             not a crisis response
  critical — self-harm / suicidal ideation, phrased in ways the deterministic keyword
             screen (app/services/risk.py) is NOT guaranteed to catch verbatim — that's
             the whole point of this layer: catching paraphrases, not repeating the list.
"""

NONE_EXAMPLES = [
    "hey, how's it going",
    "what should I make for dinner tonight",
    "I just finished my workout, feeling great",
    "can you help me understand compound interest",
    "my exam went pretty well today",
    "what's a good book to read this weekend",
    "I'm planning a trip with my friends next month",
    "traffic was really bad on the way home",
    "I got a promotion at work today!",
    "what's the weather like tomorrow",
    "I love spending time with my dog",
    "just watched a great movie, really enjoyed it",
    "can you explain how photosynthesis works",
    "I'm learning to cook Italian food",
    "my sister is visiting this weekend, excited",
    "what time does the library close",
    "I finally finished my project, feels good",
    "thinking about picking up a new hobby",
    "had a nice coffee with an old friend today",
    "can you recommend some study techniques",
    "mausam bahut accha hai aaj",
    "kal exam hai, thoda tayari kar raha hoon",
    "aaj bahut maza aaya dosto ke saath",
    "mujhe cricket dekhna pasand hai",
    "college mein naya semester shuru hua hai",
    "what's your favorite programming language",
    "I want to start going to the gym regularly",
    "just adopted a kitten, so happy",
    "planning my sister's birthday party",
    "how do I improve my resume",
    "excited for the weekend, going hiking",
    "just got back from a great vacation",
    "I'm trying out a new recipe today",
    "aaj office mein achha din tha",
    "weekend pe ghar family ke saath time bitaya",
    "what are some tips for public speaking",
    "I'm really proud of how the presentation went",
    "can we talk about my career plans",
    "just adopted a new puppy, life is good",
    "how was your day today",
]

MEDIUM_EXAMPLES = [
    "I've been feeling really stressed about my exams lately",
    "I feel so overwhelmed with everything going on right now",
    "nobody really understands what I'm going through",
    "I've been feeling pretty low the last few days",
    "I'm so anxious about my future, I don't know what I'm doing",
    "work has been draining me completely, I feel exhausted all the time",
    "I keep fighting with my parents and it's really getting to me",
    "I feel really lonely even when I'm around people",
    "I'm struggling to keep up with everything, it's a lot",
    "I haven't been sleeping well, my mind won't stop racing",
    "I feel like I'm disappointing everyone around me",
    "things have been really hard between me and my partner lately",
    "I don't feel motivated to do anything these days",
    "I'm worried I'm not good enough for this course",
    "I feel like I'm constantly failing at everything",
    "it's been a really tough week, I just feel drained",
    "I get really anxious before every exam, it's exhausting",
    "I feel stuck and don't know how to move forward",
    "I've been more irritable and sad than usual lately",
    "I feel like I'm carrying too much on my own",
    "mujhe exams ko lekar bahut tension ho rahi hai",
    "aajkal kuch bhi karne ka mann nahi karta",
    "ghar mein sabse ladai ho rahi hai, bahut stress hai",
    "mujhe lagta hai koi meri baat nahi samajhta",
    "bahut akela feel ho raha hai aajkal",
    "career ko lekar bahut confuse aur pareshan hoon",
    "neend nahi aa rahi, dimag mein bahut kuch chal raha hai",
    "office ka pressure bahut zyada ho gaya hai",
    "mujhe lagta hai main sab mein fail ho raha hoon",
    "rishtey mein bahut mushkilen chal rahi hain",
    "I feel really down today, not sure why",
    "everything feels like too much right now",
    "I'm burnt out and don't know how to fix it",
    "I feel invisible in my friend group lately",
    "I keep comparing myself to others and feeling worse",
    "I'm dreading going to college tomorrow",
    "I feel like I've lost interest in things I used to enjoy",
    "my anxiety has been really bad this week",
    "I feel disconnected from everyone around me",
    "I'm scared I'm going to disappoint my family with my results",
]

CRITICAL_EXAMPLES = [
    # deliberately phrased to NOT exactly match app/services/risk.py's keyword list —
    # this is what the ML layer is for.
    "I don't see the point in waking up tomorrow",
    "everyone would probably be better off without me around",
    "I keep thinking about just not being here anymore",
    "I can't take this pain anymore, I just want it all to stop",
    "there's no reason for me to keep going on like this",
    "I feel like disappearing forever and never coming back",
    "I don't think I can carry on like this much longer",
    "sometimes I think everyone would be relieved if I was gone",
    "I've been thinking about how to just make it all stop",
    "I feel like I'm just a burden to everyone around me",
    "I don't want to exist anymore, it's all too much",
    "I've started thinking about ways to just end everything",
    "what's even the point of trying anymore, I'm done",
    "I keep having thoughts of just giving up on everything, permanently",
    "I feel like the world would go on fine without me in it",
    "I've been planning how I would just not be here anymore",
    "I don't think I want to be alive anymore",
    "I've written down what I'd want to say if I wasn't around",
    "I just want the pain to stop, even if that means I'm not here",
    "I keep googling ways to not wake up",
    "ab aur jeene ka mann nahi karta",
    "mujhe lagta hai main sabke liye bojh hoon, sab better honge bina mere",
    "mann karta hai hamesha ke liye gayab ho jaun",
    "ab sab kuch khatam karne ka socha hai maine",
    "mujhe lagta hai ab bas karna chahiye sab kuch",
    "main soch raha hoon ki khud ko kaise khatam karoon",
    "ab jeene ki koi wajah nahi bachi hai",
    "mujhe lagta hai sab meri wajah se pareshan hain, main na hoon to accha",
    "dard itna zyada hai ki bas khatam karna chahta hoon",
    "raat ko sochta hoon ki subah na uthoon to accha",
]
