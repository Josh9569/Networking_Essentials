/* exam-keys.js — the key words of every exam flashcard, kept out of exam.js.

   One section per card:  'card id': { 'word': [similar words], ... }
   A card's model answer names a key word as [[word]] and every similar word
   here counts for it too. See kwResolve in exam.js for the rest:
     {name}            filled from the draw (gen() returns `vars`), then from
                       the card's _lists, then from _shared; a list stands for
                       each of its items, so "{W}~{CHOSE}" pairs every name
                       with every verb. No value on this draw: the form is left out.
     subject~term      counts only when the term belongs to that subject
     @ > ^ ! #         the form prefixes documented above KW_NEG in exam.js
     word#tag          two key words on one card that show the same word
   Loaded before exam.js; bump exam.html's ?v= when this file changes. */
const EXAM_KEYS={
"q1a-dynamic": {
  _lists: {
    "DYN": [
      "dynamic routing protocol", "dynamic routing", "dynamic protocol", "routing protocol", "dynamic",
      "OSPF", "EIGRP", "RIP"
    ],
    "PROTO": ["OSPF", "EIGRP", "RIP"],
    "STA": ["static routes", "static routing", "static"],
    "TAIL": ["routing protocol", "routing", "protocol"],
    "NEG": [
      "no need to", "no need for", "no reason to", "no point in", "not worth", "not need to",
      "t need to", "t need", "not", "t", "never", "rather than", "instead of", "without", "unless"
    ],
    "MOVE": [
      "move to", "moving to", "move over to", "switch to", "switching to", "change to", "changing to",
      "migrate to", "migrating to", "convert to", "upgrade to", "transition to", "go with", "going with",
      "go for", "opt for", "adopt", "adopting", "implement", "implementing", "deploy", "deploying",
      "choose", "choosing", "pick", "select", "start using", "prefer", "recommend", "suggest",
      "introduce", "introducing", "definitely", "certainly", "clearly", "obviously", "absolutely",
      "probably", "preferably", "ideally", "surely", "need a", "needs a", "need an", "needs an",
      "will need", "would need", "should have", "must have"
    ],
    "USE": ["use", "using", "run", "running", "configure", "enable"],
    "D_GOOD": [
      "better", "best", "preferable", "preferred", "suitable", "ideal", "appropriate", "recommended",
      "is needed", "are needed", "be needed", "necessary", "is required", "are required", "be required",
      "essential", "easier", "easier to manage", "more efficient", "efficient", "manageable",
      "right choice", "right call", "correct choice", "way to go", "the answer", "the solution",
      "worth it", "right option", "best option", "better option", "right choice for this", "good choice",
      "best choice", "better choice", "the way to go", "right one", "best one", "good option",
      "sensible option", "sensible choice", "obvious choice", "not overkill", "isn t overkill",
      "not over the top", "worthwhile", "should be used", "should be implemented", "should be adopted",
      "should be deployed"
    ],
    "D_DOES": [
      "learn", "adapt", "reroute", "reconverge", "automatically", "automatic", "scale", "scalable",
      "scalability", "share routes", "self healing"
    ],
    "S_BAD": [
      "impractical", "not practical", "unmanageable", "not manageable", "hard to manage",
      "difficult to manage", "too much work", "too much effort", "too much admin",
      "too much configuration", "too many", "too hard", "too difficult", "too complex",
      "too complicated", "won't scale", "will not scale", "doesn't scale", "does not scale",
      "don't scale", "do not scale", "can't scale", "cannot scale", "not scalable", "unscalable",
      "not viable", "not feasible", "infeasible", "not sustainable", "unsustainable", "not suitable",
      "unsuitable", "not appropriate", "inappropriate", "won't work", "will not work", "a nightmare",
      "not enough", "inadequate", "outgrown", "not good enough", "a bad idea", "error prone",
      "time consuming", "tedious", "no longer"
    ],
    "S_LEAVE": [
      "move away from", "moving away from", "stop using", "replace", "replacing", "get rid of", "drop",
      "abandon", "phase out", "outgrow", "outgrown", "no longer use", "no longer need"
    ],
    "S_KEEP": [
      "keep", "keeping", "keep using", "stay with", "staying with", "stay on", "stick with", "stick to",
      "sticking with", "continue using", "continue with", "continue to use", "remain with", "retain",
      "carry on with", "carry on using", "go with", "going with", "opt for", "choose", "choosing",
      "pick", "select", "use", "using", "prefer", "recommend", "suggest", "stay", "remain", "definitely",
      "certainly", "clearly", "obviously", "absolutely", "probably", "preferably", "ideally", "surely"
    ],
    "S_GOOD": [
      "right option", "best option", "better option", "right choice for this", "good choice",
      "best choice", "better choice", "the way to go", "right one", "best one", "good option",
      "sensible option", "sensible choice", "obvious choice", "okay", "ok", "good enough", "will work",
      "works", "work well", "better", "best", "preferable", "preferred", "suitable", "sufficient",
      "enough", "fine", "adequate", "appropriate", "ideal", "recommended", "right choice", "right call",
      "correct choice", "all it needs", "all they need", "will do", "would do", "works fine",
      "work fine", "perfectly fine", "the answer", "way to go", "should be used", "should be kept",
      "should stay", "should remain", "definitely", "certainly", "clearly", "obviously", "absolutely",
      "probably", "preferably", "ideally", "surely"
    ],
    "D_BAD": [
      "overkill", "unnecessary", "not necessary", "not needed", "unneeded", "not required", "pointless",
      "a waste", "wasteful", "no benefit", "no advantage", "nothing to gain", "too complex",
      "too complicated", "more complex than needed", "excessive", "not justified", "unjustified",
      "useless", "not worth it", "not worth the effort", "more than needed", "more than necessary",
      "not warranted", "over the top"
    ],
    "NOTW": ["t", "not", "never", "no need to", "no reason to"],
    "D_NOV": ["{MOVE}", "{USE}", "bother with"],
    "D_NO": [
      "{NOTW} {D_NOV}", "no need for", "no need to move to", "no need to switch to", "no need to use",
      "no need to run", "no need to implement", "no need to deploy", "no need to adopt",
      "no need to change to", "no reason to use", "no reason to move to", "no reason to switch to",
      "no point in using", "no point in moving to", "not worth moving to", "not worth using", "not need",
      "t need", "t require", "not require", "no use for", "rather than", "instead of", "without",
      "avoid"
    ],
    "GROWS": [
      "grow", "grows", "growing", "growth", "expand", "expands", "expanding", "expansion", "large",
      "larger", "big", "bigger", "many routers", "more routers", "lots of routers", "many sites",
      "more sites", "new sites", "additional sites", "extra sites", "many branches", "more branches",
      "new branches", "additional branches", "extra branches", "new routers"
    ],
    "REDUND": [
      "redundant", "redundancy", "multiple paths", "more than one path", "several paths",
      "alternate path", "alternative path", "backup link", "backup path", "multiple links",
      "more than one link", "several links", "extra links", "additional links", "mesh", "failover",
      "fail over", "link fails", "link failure", "fails", "failure", "reroute", "reconverge",
      "convergence", "adapts"
    ],
    "VERDICT_D": [
      "dynamic", "dynamic routing", "dynamic routing protocol", "a dynamic routing protocol",
      "a routing protocol", "OSPF", "EIGRP", "move to dynamic", "go dynamic", "switch to dynamic"
    ],
    "KEEP_NOT": [
      "not keep using static", "not keep static", "not stay with static", "not continue using static",
      "not continue with static", "t keep using static", "t keep static", "t stay with static",
      "stop using static", "stop relying on static", "no longer rely on static"
    ],
    "DH": [
      "dynamic", "dynamic routing", "a dynamic routing protocol", "OSPF", "EIGRP", "RIP"
    ],
    "STA_HERE": [
      "better here", "best here", "fine here", "enough here", "better for this", "best for this",
      "better for this network", "fine for this network", "enough for this network",
      "better than {DH} here"
    ],
    "USEDYN": ["use dynamic", "using dynamic"],
    "VERDICT_S": [
      "static", "static routes", "static routing", "keep static", "keep static routes",
      "keep the static routes", "keep using static routes", "stick with static",
      "stick with static routes", "stay with static"
    ],
    "DYN_HERE": [
      "better here", "best here", "needed here", "necessary here", "better for this", "needed for this"
    ],
    "STAY": [
      "stay static", "remain static", "leave it as it is", "leave it as is", "keep it as it is",
      "keep it as is", "no need to change", "t need to change", "not need to change",
      "nothing needs to change", "nothing to change", "no changes needed", "no change needed"
    ],
    "GROW_IF": [
      "once it grows", "once the company grows", "once the network expands", "once it expands",
      "once the company expands", "if the network grows", "if it grows", "if the company grows",
      "if the network expands", "if it expands", "if the company expands", "when the network grows",
      "when it grows", "when the company grows", "when the network expands", "when it expands",
      "as the network grows", "as it grows", "as the company grows", "as it expands", "grows larger",
      "grows bigger", "grows to", "grows into", "expands to", "gets bigger", "gets larger",
      "if more sites are added", "once more sites are added", "when more sites are added",
      "if new sites are added", "once new sites are added", "when new sites are added",
      "if sites are added", "if more routers are added", "once more routers are added",
      "when more routers are added", "if routers are added", "if the company adds",
      "once the company adds", "when the company adds"
    ],
    "REDUND_IF": [
      "once there are redundant links", "if there are redundant links", "when there are redundant links",
      "if there were redundant links", "if it had redundant links", "if it has redundant links",
      "if the company has redundant links", "once there is redundancy", "if there is redundancy",
      "if redundant links are added", "once redundant links are added", "when redundant links are added",
      "if backup links are added", "if there are backup links", "if there were backup links",
      "if there are multiple paths", "if there were multiple paths", "once there are multiple paths",
      "when there are multiple paths", "if there is more than one path",
      "once there is more than one path", "if links are added", "if more links are added",
      "once more links are added", "if extra links are added", "if there are multiple links",
      "if there are several links", "if there are alternate paths", "if there are alternative paths"
    ],
    "ISPW": ["ISP", "internet"],
    "STA_CLAIM": [
      "scale", "scales", "scale well", "scales well", "scalable", "is scalable", "adapt", "adapts",
      "reroute", "reroutes", "reconverge", "reconverges", "handle failures", "handles failures",
      "handle link failures", "handles link failures", "cope with failures", "copes with failures",
      "fail over", "fails over"
    ],
  },
  "scales": [
    "scale", "scalable", "scalability", "automatically", "automatic", "auto", "less admin",
    "less configuration", "less config", "less work", "less effort", "large network", "larger network",
    "big network", "bigger network", "manual configuration", "manually configure",
    "manually configuring", "manually add", "manually adding", "manually enter", "manually entering",
    "manually update", "manually updating", "manual updates", "manual work", "manual effort",
    "no manual", "without manual", "less manual", "typing routes", "type the routes", "enter routes",
    "entering routes", "@!{STA}~{STA_CLAIM}"
  ],
  "link fails": [
    "link failure", "link failures", "fails", "fail", "failure", "failures", "failover", "fail over",
    "goes down", "go down", "went down", "link down", "reroute", "re-route", "reconverge", "converge",
    "convergence", "topology change", "topology changes", "adapts", "adapt", "self-healing",
    "alternate path", "alternative path", "alternate route", "alternative route", "another path",
    "other path", "different path", "another route", "backup path", "backup route", "new path",
    "new route", "find another", "finds another", "use the redundant", "use the other link",
    "use the backup", "use the other path", "switch to the other", "fall back", "@!{STA}~{STA_CLAIM}"
  ],
  "stub network#any": [
    "stub networks", "stub", "single exit", "one exit", "only one exit", "single way out",
    "one way out", "only one way out", "only way out", "only one path", "single path",
    "only one route", "single route", "only one link", "one link out", "single link",
    "single connection", "only one connection", "no other path", "{STA}~{ISPW}"
  ],
  "small network#any": [
    "small networks", "small", "few routers", "few routes", "few networks", "handful",
    "simple network", "simple topology", "tiny", "rarely change", "rarely changes", "seldom change",
    "does not change", "doesn't change", "not change", "never change", "won't change",
    "will not change", "stable"
  ],
  "should move to a dynamic routing protocol": [
    "{DYN}~{MOVE}", "{PROTO}~{USE}", "{DYN}~{D_GOOD}", "{DYN}~{D_DOES}", "{STA}~{S_BAD}",
    "{STA}~{S_LEAVE}", "{NEG}~", "^{VERDICT_D}", "{KEEP_NOT}", "@!{STA}~{STA_HERE}", "{TAIL}~{USEDYN}"
  ],
  "should keep its static routes": [
    "{STA}~{S_KEEP}", "{STA}~{S_GOOD}", "{DYN}~{D_BAD}", "{DYN}~{D_NO}", "{NEG}~", "^{VERDICT_S}",
    "@!{DYN}~{DYN_HERE}", "{STAY}"
  ],
  "once the network grows": ["{GROW_IF}", "{DYN}~{GROWS}"],
  "once there are redundant links": ["{REDUND_IF}", "{DYN}~{REDUND}"],
  "secure": [
    "more secure", "security", "no updates", "no routing updates", "not advertised",
    "never advertised", "nothing advertised", "no advertisements", "safer"
  ],
  "no overhead": [
    "overhead", "CPU", "processing", "processor", "memory", "RAM", "bandwidth", "resources",
    "resource", "less load", "lightweight"
  ],
  "stub network": [
    "stub", "single exit", "one exit", "one way out", "only one way out", "single way out",
    "only one path", "single path", "only one route", "only route", "only one link", "one link",
    "single link", "single connection", "no other path", "no other route", "nowhere else",
    "hub and spoke", "hub-and-spoke"
  ],
  "small network": [
    "small", "few routers", "few routes", "few networks", "handful", "simple network",
    "simple topology", "tiny", "stays the same", "stay the same", "stable", "not change",
    "never change", "won't change", "doesn't change", "not grow", "won't grow", "isn't growing",
    "not growing", "no growth", "not expand", "won't expand", "not expanding", "isn't expanding",
    "no expansion", "stay small", "remain small"
  ],
},
"q1b-adpair": {
  _lists: {
    "CHOSEN": [
      "chosen", "choose", "chooses", "chose", "choice", "prefer", "preferred", "preferable", "pick",
      "picked", "select", "selected", "install", "installed", "best", "better", "winner", "beats",
      "beat", "outranks", "outrank", "overrides", "override", "overrule", "overrules"
    ],
    "LOWER": [
      "lower AD", "lowest AD", "lower administrative distance", "lowest administrative distance",
      "lower admin distance", "smaller AD", "better AD", "more trusted", "more trustworthy",
      "trusted more"
    ],
    "TAKE": [
      "use", "using", "take", "taking", "go with", "goes with", "going with", "went with", "opt for",
      "opts for"
    ],
    "USED": ["is used", "will be used", "would be used", "gets used", "is the one used"],
    "WINS": ["wins", "win", "would win", "will win", "should win"],
    "VETO": ["{CHOSEN}", "{LOWER}", "wins", "win", "is used", "will be used", "gets used"],
    "UNITS": [
      "different metric", "different scale", "different type", "different kind", "different way",
      "different method", "different measure", "different calculation", "different formula",
      "measured differently", "calculated differently", "worked out differently", "them differently",
      "it differently", "metric differently", "own metric", "own way", "not comparable", "incomparable",
      "aren't comparable", "isn't comparable", "metrics are different", "metric is different",
      "t be compared", "cannot be compared", "cant be compared", "can't compare", "cannot compare",
      "can not compare", "cant compare", "couldn't compare", "unable to compare", "no way to compare",
      "never compared", "apples", "same protocol", "same routing protocol", "same source",
      "not the same unit", "not the same units", "metrics are not the same", "metric is not the same",
      "metrics aren't the same", "mean different things", "different for each protocol",
      "different for every protocol", "different between protocols", "different in each protocol",
      "metrics are different", "different metrics"
    ],
    "XP": [
      "only within a protocol", "only within the same protocol", "within a protocol", "within one protocol",
      "within the same protocol", "inside a protocol", "inside one protocol", "not between protocols",
      "not across protocols", "between protocols", "across protocols", "compare only within",
      "only compare within", "only compared within", "not compared between", "aren t compared between",
      "are not compared between", "never compared between", "don t compare across", "do not compare across",
      "can t compare across", "cannot compare across", "don t compare between", "do not compare between",
      "can t be compared between", "cannot be compared between", "no effect", "not have any effect",
      "not have any affect", "don t have any effect", "doesn t have any effect", "have no effect",
      "has no effect", "no affect", "don t matter here", "does not matter here", "doesn t matter here"
    ],
    "NOMETRIC": [
      "no metric", "metric of 0", "metric 0", "metric is 0", "metric of zero", "zero metric",
      "t have a metric"
    ],
  },
  "the {nmW} route is chosen": [
    "@{Wn}~{CHOSEN}", "@{Wn}~{LOWER}", "@{TAKE} {Wn}", "@{Wn} {USED}", "@{Wn} {WINS}", "^{Wn}",
    "^{Wn} route", "^{Wn} routes", "@!{Ln}~{VETO}"
  ],
  "metrics aren't compared across protocols": ["different units", "{UNITS}", "{XP}", "{NM}"],
  "administrative distance": ["AD", "admin distance"],
  "trustworthy": [
    "trust", "trusts", "trusted", "trustworthiness", "reliable", "reliability", "believable",
    "credible", "credibility"
  ],
},
"q1c-admetric": {
  _lists: {
    "LOWERAD": [
      "lower administrative distance", "lowest administrative distance", "lower AD", "lowest AD",
      "smaller AD", "smallest AD", "best AD", "lower admin distance", "lowest admin distance", "low AD",
      "AD is lower", "AD is lowest", "AD is smaller", "AD is smallest", "AD is better", "AD first",
      "AD is compared first", "AD is checked first", "AD is looked at first", "AD comes first",
      "AD goes first", "AD is considered first", "AD is used first", "AD is looked at before",
      "AD is checked before", "AD is compared before", "AD is considered before", "AD is used before",
      "AD is more important", "AD matters more", "AD takes priority", "AD takes precedence", "AD before",
      "AD over the metric", "AD over metric", "AD wins", "AD decides"
    ],
    "SAMESRC": [
      "same routing protocol", "same protocol", "same source", "same AD", "same administrative distance",
      "equal AD", "equal administrative distance", "same admin distance", "same ADs", "equal ADs",
      "ADs are equal", "ADs are the same", "AD is the same", "AD is equal", "AD is tied", "ADs are tied",
      "ADs tie", "one protocol", "single protocol", "same dynamic protocol",
      "same dynamic routing protocol", "same routing source", "same routing protocols", "same protocols",
      "same type of route", "AD matches", "ADs match", "AD match", "the AD matches", "within a protocol",
      "within one protocol", "within the protocol", "inside one protocol", "tie breaker", "tiebreaker",
      "tie-break"
    ],
    "UNITS": [
      "different units", "different unit", "different metric", "different metrics",
      "metrics are different", "metric is different", "different scale", "different scales",
      "different type", "different kind", "different way", "different ways", "different method",
      "different measure", "different measurement", "different calculation", "different formula",
      "measured differently", "calculated differently", "worked out differently",
      "calculate differently", "measure differently", "metric differently", "metrics differently",
      "them differently", "own metric", "own way", "not comparable", "incomparable", "aren't comparable",
      "isn't comparable", "not directly comparable", "not compared", "never compared", "not be compared",
      "t be compared", "cannot be compared", "can not be compared", "cant be compared", "can't compare",
      "cannot compare", "can not compare", "cant compare", "unable to compare", "no way to compare",
      "apples", "arent comparable", "isnt comparable", "aren t comparable", "isn t comparable",
      "not comparable between", "dont mean the same", "don t mean the same", "do not mean the same",
      "does not mean the same", "doesnt mean the same", "doesn t mean the same", "mean different things",
      "mean different", "not the same thing", "not the same unit", "not the same units",
      "measure things differently", "measure different things", "measures different things",
      "measure something different", "measures something different", "measured differently",
      "different things", "different between protocols", "different between the protocols",
      "different across protocols", "differ between protocols", "differ across protocols",
      "differs between protocols", "different for each protocol", "different for every protocol",
      "different in each protocol", "different protocols calculate", "different protocols use different",
      "different protocols measure", "use different metrics", "uses different metrics",
      "use a different metric", "uses a different metric", "use different measures", "play no part",
      "plays no part", "have nothing to do with", "has nothing to do with", "metrics are ignored",
      "metric is ignored", "metrics are not used", "metric is not used", "metrics are not considered",
      "metric is not considered", "metrics arent considered", "metric isnt considered",
      "metrics aren t considered", "metric isn t considered", "metrics are irrelevant",
      "metric is irrelevant", "metrics are not relevant", "metric is not relevant",
      "metrics do not matter", "metric does not matter", "metrics dont matter", "metric doesnt matter",
      "metrics don t matter", "metric doesn t matter", "metrics are not looked at",
      "metric is not looked at", "get a say", "gets a say", "no say", "not the same type",
      "aren t the same type", "arent the same type", "isn t the same type", "wouldn t matter",
      "would not matter", "doesn t matter", "does not matter", "don t matter", "do not matter",
      "not relevant here", "irrelevant here", "not between protocols", "not across protocols", "only compare within",
      "compare only within", "not compared between", "never compared between", "not have any effect",
      "not have any affect", "have no effect", "has no effect"
    ],
    "LOW": [
      "{LOWERAD}", "better administrative distance", "better admin distance", "better AD",
      "more trusted", "trusted more", "more trustworthy", "more reliable", "beats", "beat"
    ],
    "WINT": [
      "R1 installs", "R1 will install", "R1 would install", "R1 should install", "R1 must install",
      "it installs", "will install", "would install", "to install", "should install", "must install",
      "is installed", "gets installed", "be installed", "is chosen", "gets chosen", "be chosen",
      "choose", "chooses", "chose", "prefer", "prefers", "is preferred", "gets preferred",
      "be preferred", "pick", "picks", "is picked", "select", "selects", "is selected", "wins", "winner",
      "is used", "be used", "gets used", "goes in", "routing table"
    ],
    "LOSET": [
      "not installed", "not chosen", "not used", "not picked", "not selected", "not preferred",
      "t installed", "t chosen", "t used", "t be installed", "t be chosen", "t be used",
      "t get installed", "loses", "lose", "backup", "reserve", "standby"
    ],
    "USEV": ["use", "using", "go with", "goes with", "take", "takes"],
    "LVETO": [
      "is installed", "gets installed", "is chosen", "gets chosen", "wins", "is the winner",
      "is preferred", "is used", "gets used", "route is used", "route is chosen", "route is installed",
      "route gets installed", "route is preferred", "route wins", "R1 installs", "R1 chooses",
      "R1 picks", "R1 prefers", "R1 uses", "is picked", "is selected"
    ],
    "ADNUM": [
      "{adW} is lower", "{adW} is less", "{adW} is smaller", "{adW} is better", "lower than {adL}",
      "less than {adL}", "smaller than {adL}", "{adW} < {adL}", "{adW} vs {adL}", "{adW} beats {adL}"
    ],
    "TWO": [
      "two {K} routes", "two {K} paths", "two routes from {K}", "both {K} routes", "both {K} paths",
      "both from {K}", "both learned by {K}", "both learned from {K}", "both routes from {K}",
      "both came from {K}", "both come from {K}", "both routes came from {K}",
      "both routes come from {K}", "both routes are from {K}", "both routes were from {K}",
      "both are from {K}", "both were from {K}", "both are {K}", "both were {K}", "both {K}",
      "inside {K}", "within {K}", "in {K} only", "only in {K}", "only within {K}", "only inside {K}",
      "between {K} routes", "between two {K} routes", "among {K} routes", "if the routes are {K}",
      "when the routes are {K}", "if both routes are {K}", "when both routes are {K}"
    ],
    "UV": ["uses", "counts", "is based on", "measures", "metric is", "metric is based on"],
  },
  "lowest administrative distance": ["{LOWERAD}"],
  "same routing protocol": ["{SAMESRC}"],
  "R1 installs the {WN} route": [
    "^{Wn}", "^{Wn} route", "^the {Wn} route", "{Wn}~{WINT}", "{Ln}~{LOSET}", "{USEV} {Wn}",
    "!{Ln}~{LVETO}"
  ],
  "{WN} has the lower AD": ["{Wn}~{LOW}", "@!{Ln}~{LOW}", "{ADNUM}"],
  "different units": ["{UNITS}", "{Wn} {UV} {WU}", "{Ln} {UV} {LU}"],
  "same routing protocol#R1": ["{SAMESRC}", "{TWO}"],
  "trustworthy": [
    "trust", "trusted", "trusts", "trustworthiness", "reliable", "reliability", "believable",
    "believability", "credible", "credibility", "confidence", "how good the source",
    "how good a source"
  ],
  "cost of the path": [
    "hop count", "best path", "best route", "shortest path", "shortest route", "fastest path",
    "fastest route", "how far", "how good the path", "how good a path", "how good the route",
    "how good a route", "quality of the path", "path quality", "length of the path", "path length",
    "cost of reaching", "cost to reach", "cost of getting", "cost of the route", "cost of the link",
    "cost of the links", "path cost", "route cost", "link cost", "cost of that path",
    "cost of that route", "bandwidth and delay", "number of hops", "how many hops",
    "distance to the network", "distance to the destination", "which path is best",
    "which route is best", "which path is the best", "which route is the best"
  ],
  "load balanced": [
    "load balance", "load balancing", "load balances", "load share", "load sharing", "load shared",
    "ECMP", "multipath", "both installed", "both are installed", "both get installed",
    "both routes are used", "both routes get used", "both routes are installed", "both go in",
    "install both", "installs both", "use both routes", "uses both routes", "split the traffic",
    "traffic is split", "share the traffic", "traffic is shared"
  ],
},
"q1d-floating": {
  "lowest AD wins": [
    "lowest wins", "lowest one wins", "lowest AD is installed", "lowest is installed",
    "lowest AD is preferred", "lowest is preferred", "lowest AD is chosen", "installs the lowest",
    "install the lowest", "installs the one with the lowest", "installs the route with the lowest",
    "install the route with the lowest", "prefers the lowest", "prefer the lowest",
    "chooses the lowest", "picks the lowest", "uses the lowest", "smallest AD wins", "prefer",
    "prefers", "preferred", "more trusted", "most trusted", "more believable", "most believable",
    "trustworthy"
  ],
  "higher AD": [
    "higher administrative distance", "higher admin distance", "higher distance", "AD higher",
    "AD is higher", "AD that is higher", "AD greater", "greater AD", "larger AD", "bigger AD",
    "AD above", "AD more than", "higher than the primary", "higher than the original",
    "higher than the dynamic", "higher number", "worse AD", "less trusted", "less trustworthy",
    "AD of 254", "higher value"
  ],
  "backup": ["backup route", "secondary", "failover", "fail over", "standby"],
  "fails": ["failure", "goes down", "lost", "unavailable", "disappears", "removed"],
  "floating static route": ["floating static", "floating route", "floating"],
},
"q1e-ripv2": {
  "RIPv1 classful and RIPv2 classless": [
    "RIPv1~classful", "RIPv1~classfull", "RIPv1~no mask", "RIPv1~no masks", "RIPv1~no subnet mask",
    "RIPv1~no subnet masks", "RIPv1~without mask", "RIPv1~without masks", "RIPv1~without a mask",
    "RIPv1~without subnet masks", "RIPv1~without a subnet mask", "RIPv1~doesn't send mask",
    "RIPv1~doesn't send masks", "RIPv1~doesn't send subnet mask", "RIPv1~doesn't send subnet masks",
    "RIPv1~doesn't include mask", "RIPv1~doesn't include masks", "RIPv1~doesn't include subnet mask",
    "RIPv1~doesn't include subnet masks", "RIPv1~doesn't carry mask", "RIPv1~doesn't carry masks",
    "RIPv1~doesn't carry subnet mask", "RIPv1~doesn't carry subnet masks",
    "RIPv1~doesn't support VLSM", "RIPv1~doesn't use mask", "RIPv1~doesn't use masks",
    "RIPv1~doesn't use subnet masks", "RIPv1~doesn't have mask", "RIPv1~doesn't have masks",
    "RIPv1~doesn't have subnet masks", "RIPv1~does not send mask", "RIPv1~does not send masks",
    "RIPv1~does not send subnet mask", "RIPv1~does not send subnet masks",
    "RIPv1~does not include mask", "RIPv1~does not include masks",
    "RIPv1~does not include subnet mask", "RIPv1~does not include subnet masks",
    "RIPv1~does not carry mask", "RIPv1~does not carry masks", "RIPv1~does not carry subnet mask",
    "RIPv1~does not carry subnet masks", "RIPv1~does not support VLSM", "RIPv1~does not use mask",
    "RIPv1~does not use masks", "RIPv1~does not use subnet masks", "RIPv1~does not have mask",
    "RIPv1~does not have masks", "RIPv1~does not have subnet masks", "RIPv1~not send mask",
    "RIPv1~not send masks", "RIPv1~not send subnet masks", "RIPv1~not include subnet masks",
    "RIPv1~not carry subnet masks", "RIPv1~not support VLSM", "RIPv1~cannot do VLSM",
    "RIPv1~can't do VLSM", "RIPv1~cannot handle VLSM", "RIPv1~can't handle VLSM",
    "RIPv1~cannot use VLSM", "RIPv1~can't use VLSM", "RIPv1~no VLSM", "RIPv1~without VLSM",
    "RIPv1~lacks masks", "RIPv1~lacks subnet masks", "RIPv1~sends no mask",
    "RIPv1~sends no subnet mask", "RIP v1~classful", "RIP v1~classfull", "RIP v1~no mask",
    "RIP v1~no masks", "RIP v1~no subnet mask", "RIP v1~no subnet masks", "RIP v1~without mask",
    "RIP v1~without masks", "RIP v1~without a mask", "RIP v1~without subnet masks",
    "RIP v1~without a subnet mask", "RIP v1~doesn't send mask", "RIP v1~doesn't send masks",
    "RIP v1~doesn't send subnet mask", "RIP v1~doesn't send subnet masks",
    "RIP v1~doesn't include mask", "RIP v1~doesn't include masks",
    "RIP v1~doesn't include subnet mask", "RIP v1~doesn't include subnet masks",
    "RIP v1~doesn't carry mask", "RIP v1~doesn't carry masks", "RIP v1~doesn't carry subnet mask",
    "RIP v1~doesn't carry subnet masks", "RIP v1~doesn't support VLSM", "RIP v1~doesn't use mask",
    "RIP v1~doesn't use masks", "RIP v1~doesn't use subnet masks", "RIP v1~doesn't have mask",
    "RIP v1~doesn't have masks", "RIP v1~doesn't have subnet masks", "RIP v1~does not send mask",
    "RIP v1~does not send masks", "RIP v1~does not send subnet mask",
    "RIP v1~does not send subnet masks", "RIP v1~does not include mask",
    "RIP v1~does not include masks", "RIP v1~does not include subnet mask",
    "RIP v1~does not include subnet masks", "RIP v1~does not carry mask",
    "RIP v1~does not carry masks", "RIP v1~does not carry subnet mask",
    "RIP v1~does not carry subnet masks", "RIP v1~does not support VLSM", "RIP v1~does not use mask",
    "RIP v1~does not use masks", "RIP v1~does not use subnet masks", "RIP v1~does not have mask",
    "RIP v1~does not have masks", "RIP v1~does not have subnet masks", "RIP v1~not send mask",
    "RIP v1~not send masks", "RIP v1~not send subnet masks", "RIP v1~not include subnet masks",
    "RIP v1~not carry subnet masks", "RIP v1~not support VLSM", "RIP v1~cannot do VLSM",
    "RIP v1~can't do VLSM", "RIP v1~cannot handle VLSM", "RIP v1~can't handle VLSM",
    "RIP v1~cannot use VLSM", "RIP v1~can't use VLSM", "RIP v1~no VLSM", "RIP v1~without VLSM",
    "RIP v1~lacks masks", "RIP v1~lacks subnet masks", "RIP v1~sends no mask",
    "RIP v1~sends no subnet mask", "v1~classful", "v1~classfull", "v1~no mask", "v1~no masks",
    "v1~no subnet mask", "v1~no subnet masks", "v1~without mask", "v1~without masks",
    "v1~without a mask", "v1~without subnet masks", "v1~without a subnet mask", "v1~doesn't send mask",
    "v1~doesn't send masks", "v1~doesn't send subnet mask", "v1~doesn't send subnet masks",
    "v1~doesn't include mask", "v1~doesn't include masks", "v1~doesn't include subnet mask",
    "v1~doesn't include subnet masks", "v1~doesn't carry mask", "v1~doesn't carry masks",
    "v1~doesn't carry subnet mask", "v1~doesn't carry subnet masks", "v1~doesn't support VLSM",
    "v1~doesn't use mask", "v1~doesn't use masks", "v1~doesn't use subnet masks",
    "v1~doesn't have mask", "v1~doesn't have masks", "v1~doesn't have subnet masks",
    "v1~does not send mask", "v1~does not send masks", "v1~does not send subnet mask",
    "v1~does not send subnet masks", "v1~does not include mask", "v1~does not include masks",
    "v1~does not include subnet mask", "v1~does not include subnet masks", "v1~does not carry mask",
    "v1~does not carry masks", "v1~does not carry subnet mask", "v1~does not carry subnet masks",
    "v1~does not support VLSM", "v1~does not use mask", "v1~does not use masks",
    "v1~does not use subnet masks", "v1~does not have mask", "v1~does not have masks",
    "v1~does not have subnet masks", "v1~not send mask", "v1~not send masks",
    "v1~not send subnet masks", "v1~not include subnet masks", "v1~not carry subnet masks",
    "v1~not support VLSM", "v1~cannot do VLSM", "v1~can't do VLSM", "v1~cannot handle VLSM",
    "v1~can't handle VLSM", "v1~cannot use VLSM", "v1~can't use VLSM", "v1~no VLSM", "v1~without VLSM",
    "v1~lacks masks", "v1~lacks subnet masks", "v1~sends no mask", "v1~sends no subnet mask",
    "version 1~classful", "version 1~classfull", "version 1~no mask", "version 1~no masks",
    "version 1~no subnet mask", "version 1~no subnet masks", "version 1~without mask",
    "version 1~without masks", "version 1~without a mask", "version 1~without subnet masks",
    "version 1~without a subnet mask", "version 1~doesn't send mask", "version 1~doesn't send masks",
    "version 1~doesn't send subnet mask", "version 1~doesn't send subnet masks",
    "version 1~doesn't include mask", "version 1~doesn't include masks",
    "version 1~doesn't include subnet mask", "version 1~doesn't include subnet masks",
    "version 1~doesn't carry mask", "version 1~doesn't carry masks",
    "version 1~doesn't carry subnet mask", "version 1~doesn't carry subnet masks",
    "version 1~doesn't support VLSM", "version 1~doesn't use mask", "version 1~doesn't use masks",
    "version 1~doesn't use subnet masks", "version 1~doesn't have mask",
    "version 1~doesn't have masks", "version 1~doesn't have subnet masks",
    "version 1~does not send mask", "version 1~does not send masks",
    "version 1~does not send subnet mask", "version 1~does not send subnet masks",
    "version 1~does not include mask", "version 1~does not include masks",
    "version 1~does not include subnet mask", "version 1~does not include subnet masks",
    "version 1~does not carry mask", "version 1~does not carry masks",
    "version 1~does not carry subnet mask", "version 1~does not carry subnet masks",
    "version 1~does not support VLSM", "version 1~does not use mask", "version 1~does not use masks",
    "version 1~does not use subnet masks", "version 1~does not have mask",
    "version 1~does not have masks", "version 1~does not have subnet masks", "version 1~not send mask",
    "version 1~not send masks", "version 1~not send subnet masks",
    "version 1~not include subnet masks", "version 1~not carry subnet masks",
    "version 1~not support VLSM", "version 1~cannot do VLSM", "version 1~can't do VLSM",
    "version 1~cannot handle VLSM", "version 1~can't handle VLSM", "version 1~cannot use VLSM",
    "version 1~can't use VLSM", "version 1~no VLSM", "version 1~without VLSM", "version 1~lacks masks",
    "version 1~lacks subnet masks", "version 1~sends no mask", "version 1~sends no subnet mask",
    "RIP version 1~classful", "RIP version 1~classfull", "RIP version 1~no mask",
    "RIP version 1~no masks", "RIP version 1~no subnet mask", "RIP version 1~no subnet masks",
    "RIP version 1~without mask", "RIP version 1~without masks", "RIP version 1~without a mask",
    "RIP version 1~without subnet masks", "RIP version 1~without a subnet mask",
    "RIP version 1~doesn't send mask", "RIP version 1~doesn't send masks",
    "RIP version 1~doesn't send subnet mask", "RIP version 1~doesn't send subnet masks",
    "RIP version 1~doesn't include mask", "RIP version 1~doesn't include masks",
    "RIP version 1~doesn't include subnet mask", "RIP version 1~doesn't include subnet masks",
    "RIP version 1~doesn't carry mask", "RIP version 1~doesn't carry masks",
    "RIP version 1~doesn't carry subnet mask", "RIP version 1~doesn't carry subnet masks",
    "RIP version 1~doesn't support VLSM", "RIP version 1~doesn't use mask",
    "RIP version 1~doesn't use masks", "RIP version 1~doesn't use subnet masks",
    "RIP version 1~doesn't have mask", "RIP version 1~doesn't have masks",
    "RIP version 1~doesn't have subnet masks", "RIP version 1~does not send mask",
    "RIP version 1~does not send masks", "RIP version 1~does not send subnet mask",
    "RIP version 1~does not send subnet masks", "RIP version 1~does not include mask",
    "RIP version 1~does not include masks", "RIP version 1~does not include subnet mask",
    "RIP version 1~does not include subnet masks", "RIP version 1~does not carry mask",
    "RIP version 1~does not carry masks", "RIP version 1~does not carry subnet mask",
    "RIP version 1~does not carry subnet masks", "RIP version 1~does not support VLSM",
    "RIP version 1~does not use mask", "RIP version 1~does not use masks",
    "RIP version 1~does not use subnet masks", "RIP version 1~does not have mask",
    "RIP version 1~does not have masks", "RIP version 1~does not have subnet masks",
    "RIP version 1~not send mask", "RIP version 1~not send masks",
    "RIP version 1~not send subnet masks", "RIP version 1~not include subnet masks",
    "RIP version 1~not carry subnet masks", "RIP version 1~not support VLSM",
    "RIP version 1~cannot do VLSM", "RIP version 1~can't do VLSM", "RIP version 1~cannot handle VLSM",
    "RIP version 1~can't handle VLSM", "RIP version 1~cannot use VLSM", "RIP version 1~can't use VLSM",
    "RIP version 1~no VLSM", "RIP version 1~without VLSM", "RIP version 1~lacks masks",
    "RIP version 1~lacks subnet masks", "RIP version 1~sends no mask",
    "RIP version 1~sends no subnet mask", "RIPv2~classless", "RIPv2~classless routing",
    "RIPv2~carries the mask", "RIPv2~carries masks", "RIPv2~carries subnet masks",
    "RIPv2~carries the subnet mask", "RIPv2~sends the mask", "RIPv2~sends masks",
    "RIPv2~sends subnet masks", "RIPv2~sends the subnet mask", "RIPv2~sends the mask with",
    "RIPv2~includes the mask", "RIPv2~includes masks", "RIPv2~includes subnet masks",
    "RIPv2~includes the subnet mask", "RIPv2~subnet mask", "RIPv2~subnet masks", "RIPv2~mask",
    "RIPv2~masks", "RIPv2~VLSM", "RIPv2~supports VLSM", "RIPv2~CIDR", "RIPv2~variable-length",
    "RIPv2~variable length", "RIPv2~discontiguous", "RIP v2~classless", "RIP v2~classless routing",
    "RIP v2~carries the mask", "RIP v2~carries masks", "RIP v2~carries subnet masks",
    "RIP v2~carries the subnet mask", "RIP v2~sends the mask", "RIP v2~sends masks",
    "RIP v2~sends subnet masks", "RIP v2~sends the subnet mask", "RIP v2~sends the mask with",
    "RIP v2~includes the mask", "RIP v2~includes masks", "RIP v2~includes subnet masks",
    "RIP v2~includes the subnet mask", "RIP v2~subnet mask", "RIP v2~subnet masks", "RIP v2~mask",
    "RIP v2~masks", "RIP v2~VLSM", "RIP v2~supports VLSM", "RIP v2~CIDR", "RIP v2~variable-length",
    "RIP v2~variable length", "RIP v2~discontiguous", "v2~classless", "v2~classless routing",
    "v2~carries the mask", "v2~carries masks", "v2~carries subnet masks", "v2~carries the subnet mask",
    "v2~sends the mask", "v2~sends masks", "v2~sends subnet masks", "v2~sends the subnet mask",
    "v2~sends the mask with", "v2~includes the mask", "v2~includes masks", "v2~includes subnet masks",
    "v2~includes the subnet mask", "v2~subnet mask", "v2~subnet masks", "v2~mask", "v2~masks",
    "v2~VLSM", "v2~supports VLSM", "v2~CIDR", "v2~variable-length", "v2~variable length",
    "v2~discontiguous", "version 2~classless", "version 2~classless routing",
    "version 2~carries the mask", "version 2~carries masks", "version 2~carries subnet masks",
    "version 2~carries the subnet mask", "version 2~sends the mask", "version 2~sends masks",
    "version 2~sends subnet masks", "version 2~sends the subnet mask", "version 2~sends the mask with",
    "version 2~includes the mask", "version 2~includes masks", "version 2~includes subnet masks",
    "version 2~includes the subnet mask", "version 2~subnet mask", "version 2~subnet masks",
    "version 2~mask", "version 2~masks", "version 2~VLSM", "version 2~supports VLSM", "version 2~CIDR",
    "version 2~variable-length", "version 2~variable length", "version 2~discontiguous",
    "RIP version 2~classless", "RIP version 2~classless routing", "RIP version 2~carries the mask",
    "RIP version 2~carries masks", "RIP version 2~carries subnet masks",
    "RIP version 2~carries the subnet mask", "RIP version 2~sends the mask",
    "RIP version 2~sends masks", "RIP version 2~sends subnet masks",
    "RIP version 2~sends the subnet mask", "RIP version 2~sends the mask with",
    "RIP version 2~includes the mask", "RIP version 2~includes masks",
    "RIP version 2~includes subnet masks", "RIP version 2~includes the subnet mask",
    "RIP version 2~subnet mask", "RIP version 2~subnet masks", "RIP version 2~mask",
    "RIP version 2~masks", "RIP version 2~VLSM", "RIP version 2~supports VLSM", "RIP version 2~CIDR",
    "RIP version 2~variable-length", "RIP version 2~variable length", "RIP version 2~discontiguous"
  ],
  "RIPv1 broadcasts and RIPv2 multicasts": [
    "RIPv1~broadcast", "RIPv1~broadcasts", "RIPv1~broadcasting", "RIPv1~255.255.255.255",
    "RIPv1~broadcast address", "RIP v1~broadcast", "RIP v1~broadcasts", "RIP v1~broadcasting",
    "RIP v1~255.255.255.255", "RIP v1~broadcast address", "v1~broadcast", "v1~broadcasts",
    "v1~broadcasting", "v1~255.255.255.255", "v1~broadcast address", "version 1~broadcast",
    "version 1~broadcasts", "version 1~broadcasting", "version 1~255.255.255.255",
    "version 1~broadcast address", "RIP version 1~broadcast", "RIP version 1~broadcasts",
    "RIP version 1~broadcasting", "RIP version 1~255.255.255.255", "RIP version 1~broadcast address",
    "RIPv2~multicast", "RIPv2~multicasts", "RIPv2~multicasting", "RIPv2~224.0.0.9",
    "RIPv2~multicast address", "RIP v2~multicast", "RIP v2~multicasts", "RIP v2~multicasting",
    "RIP v2~224.0.0.9", "RIP v2~multicast address", "v2~multicast", "v2~multicasts", "v2~multicasting",
    "v2~224.0.0.9", "v2~multicast address", "version 2~multicast", "version 2~multicasts",
    "version 2~multicasting", "version 2~224.0.0.9", "version 2~multicast address",
    "RIP version 2~multicast", "RIP version 2~multicasts", "RIP version 2~multicasting",
    "RIP version 2~224.0.0.9", "RIP version 2~multicast address"
  ],
  "RIPv2 can authenticate": [
    "RIPv2~authenticate", "RIPv2~auth", "RIP v2~auth", "v2~auth", "version 2~auth", "RIP version 2~auth", "RIPv2~authenticates", "RIPv2~authentication", "RIPv2~authenticated",
    "RIPv2~MD5", "RIP v2~authenticate", "RIP v2~authenticates", "RIP v2~authentication",
    "RIP v2~authenticated", "RIP v2~MD5", "v2~authenticate", "v2~authenticates", "v2~authentication",
    "v2~authenticated", "v2~MD5", "version 2~authenticate", "version 2~authenticates",
    "version 2~authentication", "version 2~authenticated", "version 2~MD5",
    "RIP version 2~authenticate", "RIP version 2~authenticates", "RIP version 2~authentication",
    "RIP version 2~authenticated", "RIP version 2~MD5"
  ],
  "hop count": ["hops", "hop"],
  "auto-summarise": [
    "auto-summary", "auto summary", "autosummary", "automatically summarise",
    "automatically summarises", "automatic summarisation", "automatic summary",
    "summarise automatically", "summarises automatically", "summarise at classful",
    "summarises at classful", "summarise at the classful", "summarises at the classful",
    "summarise to classful", "summarise to the classful", "summarises to the classful",
    "classful boundary", "classful boundaries", "classful summary", "classful summarisation"
  ],
  "classless": [
    "subnet mask", "subnet masks", "carries the mask", "sends the mask", "includes the mask",
    "carries masks", "sends masks", "includes masks", "VLSM", "CIDR", "variable-length",
    "variable length", "discontiguous"
  ],
  "multicasts": ["multicast", "224.0.0.9"],
  "authenticate": ["authentication", "authenticated", "authenticates", "auth", "MD5"],
  "auto-summary": [
    "auto-summarise", "auto summary", "autosummary", "automatic summarisation",
    "automatically summarise", "automatic summary", "summarise automatically",
    "summarisation at classful boundaries", "summarising at classful boundaries",
    "classful summarisation", "classful summary"
  ],
},
"q1f-riploops": {
  "advertise a route back out the interface it was learned on": [
    "advertise~back", "send~back", "announce~back", "advertise~same interface", "send~same interface",
    "out the interface it", "out the same interface", "interface it was learned",
    "interface it learned", "interface it came", "interface it was received", "interface it received",
    "interface it arrived", "sent back where", "send back where", "sending back where",
    "back where it came from", "back where they came from", "back the way it came",
    "back the way they came", "back the way it was learned", "back the way they were learned",
    "back down the port", "back out the port", "back down the interface", "back out the same port",
    "port it was learned", "port it came", "port they came", "port it was received"
  ],
  "feeding each other": [
    "feed each other", "feeds each other", "ping-pong", "pass it between each other",
    "keep passing it between"
  ],
  "routing loop": [
    "routing loops", "forwarding loop", "forwarding loops", "endless loop", "loop between",
    "loops between", "looping between", "loop around", "loops around", "loop round",
    "go round in circles", "round in circles", "loop in the network", "loops in the network",
    "loop in a network", "forms a loop", "form a loop", "creates a loop", "create a loop",
    "stuck in a loop", "prevent loops", "prevents loops", "stop loops", "stops loops", "avoid loops",
    "avoids loops"
  ],
  "counting to infinity": [
    "count to infinity", "count-to-infinity", "counts to infinity", "count up to infinity",
    "counting up to infinity", "count forever", "counts forever", "count up forever",
    "counting up forever", "infinite loop", "infinite loops", "infinite looping", "infinitely looping",
    "loop infinitely", "loops infinitely", "looping infinitely", "infinite count", "infinitely",
    "loop forever", "loops forever", "looping forever", "looped forever", "keep looping",
    "keeps looping", "go on forever", "goes on forever", "going on forever", "carry on forever",
    "increase forever", "increases forever", "increasing forever", "rise forever", "rises forever",
    "grow forever", "grows forever", "for ever", "forever"
  ],
  "16 means unreachable": [
    "16~unreachable", "16~infinity", "16~infinite", "16~invalid", "16~dropped", "16~removed",
    "16~discarded", "16~down", "16~too far", "16~gone", "16~forever", "16~dead", "16~invalid route",
    "reaches 16", "reach 16", "hits 16", "hit 16", "gets to 16", "get to 16", "reaching 16",
    "until 16", "sixteen~unreachable", "sixteen~infinity", "sixteen~dropped", "sixteen~gone",
    "sixteen~forever", "sixteen~dead", "sixteen~removed", "sixteen~infinite"
  ],
  "hop count": ["hop counts", "hops", "number of routers"],
  "sends its routing table to its neighbours": [
    "sends its routing table", "send its routing table", "sends their routing table", "send their routing tables",
    "sends routing tables", "shares its routing table", "share their routing tables", "whole routing table",
    "full routing table", "entire routing table", "routing table to its neighbours", "routing updates",
    "periodic updates", "sends updates", "send updates", "advertises its routes", "advertise their routes",
    "advertise routes", "advertises routes", "advertise the route", "advertises the route",
    "learns from its neighbours", "learn from its neighbours", "learn from neighbours",
    "what its neighbours tell it", "routing by rumour", "distance vector", "distance-vector"
  ],
  "30 seconds": ["30 s", "30 sec", "30 secs", "30secs", "every 30"],
  "marked invalid after 180 seconds": [
    "180 seconds", "180 s", "180 sec", "#180", "invalid timer", "marked invalid", "marked as invalid",
    "marks it invalid", "marks it as invalid", "timer runs out", "timer expires", "times out", "timed out",
    "stops hearing", "no longer hears", "not heard", "stops receiving updates", "holddown", "hold-down",
    "hold down timer", "flush timer", "flushed", "240 seconds", "#240"
  ],
  "adds one hop": [
    "add one hop", "adds a hop", "add a hop", "adds one", "add one", "plus one", "increases by one",
    "increase by one", "increments", "incremented", "goes up by one", "going up by one",
    "keeps increasing", "keep increasing", "keeps going up", "keep going up", "keeps rising",
    "keep rising", "keeps growing", "keep growing"
  ],
},
"q1g-autosum": {
  _lists: {
    "T": [
      "hears it from both", "hear it from both", "gets it from both", "learns it from both",
      "receives it from both", "hears from both", "learns from both", "gets it twice", "both sides",
      "both directions", "both neighbours", "both neighbors", "both routers", "both ends",
      "both interfaces", "both links", "both of its interfaces", "both of its links", "both of them",
      "both of its neighbours", "both of its neighbors", "from both of them", "from both of its",
      "each side", "either side", "either direction", "either neighbour", "two neighbours",
      "two neighbors", "two sides", "two interfaces", "two sources", "two directions", "two routes",
      "two paths", "two equal", "two copies", "two next hops", "two entries", "2 routes", "2 paths",
      "2 equal", "2 entries", "twice", "duplicate routes", "equal cost", "same hop count", "same metric",
      "equal metric", "equal hop count", "same network", "same route", "same summary", "same prefix",
      "same update", "same advertisement", "both {A} and {B}", "from {A} and {B}",
      "from {A} and from {B}", "via {A} and {B}", "through {A} and {B}", "between {A} and {B}",
      "both {B} and {A}", "from {B} and {A}", "from {B} and from {A}", "via {B} and {A}",
      "through {B} and {A}", "between {B} and {A}"
    ],
  },
  "{sum}": [
    "{maj} {mask}", "/{pfx} summary", "/{pfx} route", "/{pfx} network", "classful summary",
    "classful network", "major network"
  ],
  "{M} learns that one route from both {A} and {B}": ["{M}~{T}", "middle~{T}", "{A}~", "{B}~"],
  "no auto-summary": [
    "no auto-summary", "without auto-summary", "turn auto-summary off", "switch auto-summary off",
    "turning auto-summary off", "stop auto-summary", "stopping auto-summary", "disable auto-summary",
    "disabling auto-summary", "turn off auto-summary", "turning off auto-summary",
    "switch off auto-summary", "switching off auto-summary", "remove auto-summary",
    "removing auto-summary", "deactivate auto-summary", "auto-summary disabled",
    "auto-summary turned off", "auto-summary switched off", "auto-summary off", "auto-summary removed",
    "auto-summary stopped", "auto-summary deactivated", "auto-summary not enabled",
    "auto-summary not used", "auto-summary not on", "auto-summary is disabled",
    "auto-summary is turned off", "auto-summary is switched off", "auto-summary is off",
    "auto-summary is removed", "auto-summary is stopped", "auto-summary is deactivated",
    "auto-summary is not enabled", "auto-summary is not used", "auto-summary is not on",
    "auto-summary are disabled", "auto-summary are turned off", "auto-summary are switched off",
    "auto-summary are off", "auto-summary are removed", "auto-summary are stopped",
    "auto-summary are deactivated", "auto-summary are not enabled", "auto-summary are not used",
    "auto-summary are not on", "auto-summary should be disabled", "auto-summary should be turned off",
    "auto-summary should be switched off", "auto-summary should be off",
    "auto-summary should be removed", "auto-summary should be stopped",
    "auto-summary should be deactivated", "auto-summary should be not enabled",
    "auto-summary should be not used", "auto-summary should be not on",
    "auto-summary must be disabled", "auto-summary must be turned off",
    "auto-summary must be switched off", "auto-summary must be off", "auto-summary must be removed",
    "auto-summary must be stopped", "auto-summary must be deactivated",
    "auto-summary must be not enabled", "auto-summary must be not used", "auto-summary must be not on",
    "auto-summary needs to be disabled", "auto-summary needs to be turned off",
    "auto-summary needs to be switched off", "auto-summary needs to be off",
    "auto-summary needs to be removed", "auto-summary needs to be stopped",
    "auto-summary needs to be deactivated", "auto-summary needs to be not enabled",
    "auto-summary needs to be not used", "auto-summary needs to be not on",
    "auto-summary has to be disabled", "auto-summary has to be turned off",
    "auto-summary has to be switched off", "auto-summary has to be off",
    "auto-summary has to be removed", "auto-summary has to be stopped",
    "auto-summary has to be deactivated", "auto-summary has to be not enabled",
    "auto-summary has to be not used", "auto-summary has to be not on",
    "auto-summary have to be disabled", "auto-summary have to be turned off",
    "auto-summary have to be switched off", "auto-summary have to be off",
    "auto-summary have to be removed", "auto-summary have to be stopped",
    "auto-summary have to be deactivated", "auto-summary have to be not enabled",
    "auto-summary have to be not used", "auto-summary have to be not on",
    "auto-summary can be disabled", "auto-summary can be turned off",
    "auto-summary can be switched off", "auto-summary can be off", "auto-summary can be removed",
    "auto-summary can be stopped", "auto-summary can be deactivated",
    "auto-summary can be not enabled", "auto-summary can be not used", "auto-summary can be not on",
    "auto-summary be disabled", "auto-summary be turned off", "auto-summary be switched off",
    "auto-summary be off", "auto-summary be removed", "auto-summary be stopped",
    "auto-summary be deactivated", "auto-summary be not enabled", "auto-summary be not used",
    "auto-summary be not on", "no autosummary", "without autosummary", "turn autosummary off",
    "switch autosummary off", "turning autosummary off", "stop autosummary", "stopping autosummary",
    "disable autosummary", "disabling autosummary", "turn off autosummary", "turning off autosummary",
    "switch off autosummary", "switching off autosummary", "remove autosummary",
    "removing autosummary", "deactivate autosummary", "autosummary disabled", "autosummary turned off",
    "autosummary switched off", "autosummary off", "autosummary removed", "autosummary stopped",
    "autosummary deactivated", "autosummary not enabled", "autosummary not used", "autosummary not on",
    "autosummary is disabled", "autosummary is turned off", "autosummary is switched off",
    "autosummary is off", "autosummary is removed", "autosummary is stopped",
    "autosummary is deactivated", "autosummary is not enabled", "autosummary is not used",
    "autosummary is not on", "autosummary are disabled", "autosummary are turned off",
    "autosummary are switched off", "autosummary are off", "autosummary are removed",
    "autosummary are stopped", "autosummary are deactivated", "autosummary are not enabled",
    "autosummary are not used", "autosummary are not on", "autosummary should be disabled",
    "autosummary should be turned off", "autosummary should be switched off",
    "autosummary should be off", "autosummary should be removed", "autosummary should be stopped",
    "autosummary should be deactivated", "autosummary should be not enabled",
    "autosummary should be not used", "autosummary should be not on", "autosummary must be disabled",
    "autosummary must be turned off", "autosummary must be switched off", "autosummary must be off",
    "autosummary must be removed", "autosummary must be stopped", "autosummary must be deactivated",
    "autosummary must be not enabled", "autosummary must be not used", "autosummary must be not on",
    "autosummary needs to be disabled", "autosummary needs to be turned off",
    "autosummary needs to be switched off", "autosummary needs to be off",
    "autosummary needs to be removed", "autosummary needs to be stopped",
    "autosummary needs to be deactivated", "autosummary needs to be not enabled",
    "autosummary needs to be not used", "autosummary needs to be not on",
    "autosummary has to be disabled", "autosummary has to be turned off",
    "autosummary has to be switched off", "autosummary has to be off", "autosummary has to be removed",
    "autosummary has to be stopped", "autosummary has to be deactivated",
    "autosummary has to be not enabled", "autosummary has to be not used",
    "autosummary has to be not on", "autosummary have to be disabled",
    "autosummary have to be turned off", "autosummary have to be switched off",
    "autosummary have to be off", "autosummary have to be removed", "autosummary have to be stopped",
    "autosummary have to be deactivated", "autosummary have to be not enabled",
    "autosummary have to be not used", "autosummary have to be not on", "autosummary can be disabled",
    "autosummary can be turned off", "autosummary can be switched off", "autosummary can be off",
    "autosummary can be removed", "autosummary can be stopped", "autosummary can be deactivated",
    "autosummary can be not enabled", "autosummary can be not used", "autosummary can be not on",
    "autosummary be disabled", "autosummary be turned off", "autosummary be switched off",
    "autosummary be off", "autosummary be removed", "autosummary be stopped",
    "autosummary be deactivated", "autosummary be not enabled", "autosummary be not used",
    "autosummary be not on", "no automatic summarisation", "without automatic summarisation",
    "turn automatic summarisation off", "switch automatic summarisation off",
    "turning automatic summarisation off", "stop automatic summarisation",
    "stopping automatic summarisation", "disable automatic summarisation",
    "disabling automatic summarisation", "turn off automatic summarisation",
    "turning off automatic summarisation", "switch off automatic summarisation",
    "switching off automatic summarisation", "remove automatic summarisation",
    "removing automatic summarisation", "deactivate automatic summarisation",
    "automatic summarisation disabled", "automatic summarisation turned off",
    "automatic summarisation switched off", "automatic summarisation off",
    "automatic summarisation removed", "automatic summarisation stopped",
    "automatic summarisation deactivated", "automatic summarisation not enabled",
    "automatic summarisation not used", "automatic summarisation not on",
    "automatic summarisation is disabled", "automatic summarisation is turned off",
    "automatic summarisation is switched off", "automatic summarisation is off",
    "automatic summarisation is removed", "automatic summarisation is stopped",
    "automatic summarisation is deactivated", "automatic summarisation is not enabled",
    "automatic summarisation is not used", "automatic summarisation is not on",
    "automatic summarisation are disabled", "automatic summarisation are turned off",
    "automatic summarisation are switched off", "automatic summarisation are off",
    "automatic summarisation are removed", "automatic summarisation are stopped",
    "automatic summarisation are deactivated", "automatic summarisation are not enabled",
    "automatic summarisation are not used", "automatic summarisation are not on",
    "automatic summarisation should be disabled", "automatic summarisation should be turned off",
    "automatic summarisation should be switched off", "automatic summarisation should be off",
    "automatic summarisation should be removed", "automatic summarisation should be stopped",
    "automatic summarisation should be deactivated", "automatic summarisation should be not enabled",
    "automatic summarisation should be not used", "automatic summarisation should be not on",
    "automatic summarisation must be disabled", "automatic summarisation must be turned off",
    "automatic summarisation must be switched off", "automatic summarisation must be off",
    "automatic summarisation must be removed", "automatic summarisation must be stopped",
    "automatic summarisation must be deactivated", "automatic summarisation must be not enabled",
    "automatic summarisation must be not used", "automatic summarisation must be not on",
    "automatic summarisation needs to be disabled", "automatic summarisation needs to be turned off",
    "automatic summarisation needs to be switched off", "automatic summarisation needs to be off",
    "automatic summarisation needs to be removed", "automatic summarisation needs to be stopped",
    "automatic summarisation needs to be deactivated",
    "automatic summarisation needs to be not enabled", "automatic summarisation needs to be not used",
    "automatic summarisation needs to be not on", "automatic summarisation has to be disabled",
    "automatic summarisation has to be turned off", "automatic summarisation has to be switched off",
    "automatic summarisation has to be off", "automatic summarisation has to be removed",
    "automatic summarisation has to be stopped", "automatic summarisation has to be deactivated",
    "automatic summarisation has to be not enabled", "automatic summarisation has to be not used",
    "automatic summarisation has to be not on", "automatic summarisation have to be disabled",
    "automatic summarisation have to be turned off", "automatic summarisation have to be switched off",
    "automatic summarisation have to be off", "automatic summarisation have to be removed",
    "automatic summarisation have to be stopped", "automatic summarisation have to be deactivated",
    "automatic summarisation have to be not enabled", "automatic summarisation have to be not used",
    "automatic summarisation have to be not on", "automatic summarisation can be disabled",
    "automatic summarisation can be turned off", "automatic summarisation can be switched off",
    "automatic summarisation can be off", "automatic summarisation can be removed",
    "automatic summarisation can be stopped", "automatic summarisation can be deactivated",
    "automatic summarisation can be not enabled", "automatic summarisation can be not used",
    "automatic summarisation can be not on", "automatic summarisation be disabled",
    "automatic summarisation be turned off", "automatic summarisation be switched off",
    "automatic summarisation be off", "automatic summarisation be removed",
    "automatic summarisation be stopped", "automatic summarisation be deactivated",
    "automatic summarisation be not enabled", "automatic summarisation be not used",
    "automatic summarisation be not on", "no automatic summary", "without automatic summary",
    "turn automatic summary off", "switch automatic summary off", "turning automatic summary off",
    "stop automatic summary", "stopping automatic summary", "disable automatic summary",
    "disabling automatic summary", "turn off automatic summary", "turning off automatic summary",
    "switch off automatic summary", "switching off automatic summary", "remove automatic summary",
    "removing automatic summary", "deactivate automatic summary", "automatic summary disabled",
    "automatic summary turned off", "automatic summary switched off", "automatic summary off",
    "automatic summary removed", "automatic summary stopped", "automatic summary deactivated",
    "automatic summary not enabled", "automatic summary not used", "automatic summary not on",
    "automatic summary is disabled", "automatic summary is turned off",
    "automatic summary is switched off", "automatic summary is off", "automatic summary is removed",
    "automatic summary is stopped", "automatic summary is deactivated",
    "automatic summary is not enabled", "automatic summary is not used", "automatic summary is not on",
    "automatic summary are disabled", "automatic summary are turned off",
    "automatic summary are switched off", "automatic summary are off", "automatic summary are removed",
    "automatic summary are stopped", "automatic summary are deactivated",
    "automatic summary are not enabled", "automatic summary are not used",
    "automatic summary are not on", "automatic summary should be disabled",
    "automatic summary should be turned off", "automatic summary should be switched off",
    "automatic summary should be off", "automatic summary should be removed",
    "automatic summary should be stopped", "automatic summary should be deactivated",
    "automatic summary should be not enabled", "automatic summary should be not used",
    "automatic summary should be not on", "automatic summary must be disabled",
    "automatic summary must be turned off", "automatic summary must be switched off",
    "automatic summary must be off", "automatic summary must be removed",
    "automatic summary must be stopped", "automatic summary must be deactivated",
    "automatic summary must be not enabled", "automatic summary must be not used",
    "automatic summary must be not on", "automatic summary needs to be disabled",
    "automatic summary needs to be turned off", "automatic summary needs to be switched off",
    "automatic summary needs to be off", "automatic summary needs to be removed",
    "automatic summary needs to be stopped", "automatic summary needs to be deactivated",
    "automatic summary needs to be not enabled", "automatic summary needs to be not used",
    "automatic summary needs to be not on", "automatic summary has to be disabled",
    "automatic summary has to be turned off", "automatic summary has to be switched off",
    "automatic summary has to be off", "automatic summary has to be removed",
    "automatic summary has to be stopped", "automatic summary has to be deactivated",
    "automatic summary has to be not enabled", "automatic summary has to be not used",
    "automatic summary has to be not on", "automatic summary have to be disabled",
    "automatic summary have to be turned off", "automatic summary have to be switched off",
    "automatic summary have to be off", "automatic summary have to be removed",
    "automatic summary have to be stopped", "automatic summary have to be deactivated",
    "automatic summary have to be not enabled", "automatic summary have to be not used",
    "automatic summary have to be not on", "automatic summary can be disabled",
    "automatic summary can be turned off", "automatic summary can be switched off",
    "automatic summary can be off", "automatic summary can be removed",
    "automatic summary can be stopped", "automatic summary can be deactivated",
    "automatic summary can be not enabled", "automatic summary can be not used",
    "automatic summary can be not on", "automatic summary be disabled",
    "automatic summary be turned off", "automatic summary be switched off", "automatic summary be off",
    "automatic summary be removed", "automatic summary be stopped", "automatic summary be deactivated",
    "automatic summary be not enabled", "automatic summary be not used", "automatic summary be not on",
    "disable summarisation", "disabling summarisation", "turn off summarisation",
    "turning off summarisation"
  ],
  "all three routers": [
    "every router", "all routers", "all three", "all 3", "all the routers", "all of the routers",
    "all of the three", "the three routers", "the 3 routers", "three routers", "3 routers",
    "all 3 of the routers", "all three of the routers", "all three of them", "each router",
    "each of the routers", "each of the three", "each of them", "every one of them",
    "every RIP router", "including the middle router", "also the middle router",
    "every router running RIP", "including {M}", "also on {M}", "as well as {M}", "even {M}",
    "R1 R2 and R3", "R1 R2 R3", "R1 R3 and R2", "R1 R3 R2", "R2 R1 and R3", "R2 R1 R3", "R2 R3 and R1",
    "R2 R3 R1", "R3 R1 and R2", "R3 R1 R2", "R3 R2 and R1", "R3 R2 R1"
  ],
  "load-balances": [
    "load-balances", "load balance", "load balancing", "load balanced", "load-share", "load shares",
    "load sharing", "ECMP", "equal cost load", "round robin", "round-robin", "per packet",
    "per-packet", "alternates between", "alternate between", "alternating between",
    "alternates packets", "alternate packets", "alternating packets", "alternates traffic",
    "alternates the packets", "alternates the traffic", "splits traffic", "split traffic",
    "splits the traffic", "split the traffic", "traffic is split", "traffic gets split",
    "traffic split", "splits packets", "split packets", "split across", "splits across",
    "split between", "splits between", "splitting traffic", "splitting the traffic", "divides traffic",
    "divide traffic", "divides the traffic", "traffic is divided", "divided between", "divided across",
    "divided equally", "shares traffic", "share traffic", "shares the traffic", "share the traffic",
    "shared between", "shared across", "spreads traffic", "spread traffic", "spreads the traffic",
    "spread the traffic", "spread across", "spread between", "spread over", "spreads across",
    "spreads between", "distributes traffic", "distribute traffic", "distributes the traffic",
    "distributes packets", "distributed across", "distributed between", "distributed evenly",
    "balances traffic", "balance traffic", "balances the traffic", "balances between",
    "balance between", "balances across", "uses both", "use both", "using both", "used both",
    "down both", "over both", "across both", "through both", "via both", "sends to both",
    "sends traffic to both", "sends packets to both", "sent to both", "both routes equally",
    "both paths equally", "both links equally", "equally between", "equally across", "50/50",
    "fifty fifty", "shares the load", "share the load", "sharing the load", "splits the load",
    "split the load", "splitting the load", "balances the load", "balance the load", "half to each",
    "half the traffic to each", "half of the traffic to each", "half the packets to each",
    "half of the packets to each", "half via each", "half down each", "half each way",
    "half goes to each"
  ],
  "version 2": ["v2", "ripv2", "RIP v2", "RIP version 2"],
  "auto-summarises": [
    "autosummary", "auto summary", "auto summarisation", "automatic summarisation",
    "automatic summary", "automatically summarise", "RIP summarises", "summarises at",
    "summarises when", "summarises as", "summarises before", "summarises across", "are summarised",
    "is summarised", "get summarised", "gets summarised", "summarised by", "classful boundary",
    "classful boundaries", "major network boundary"
  ],
},
"q2a-rid": {
  "uniquely identifies": [
    "unique", "uniquely", "identify", "identifies", "identifier", "identification", "identity"
  ],
  "DR/BDR election": ["DR", "BDR", "designated router", "election"],
  "router-id": ["router id"],
  "highest": ["largest", "biggest"],
  "loopback": ["loopbacks"],
  "active": [
    "up interface", "interfaces that are up", "physical interface", "physical interfaces", "enabled",
    "operational"
  ],
  "when the OSPF process starts": [
    "process starts", "process start", "ospf starts", "ospf start", "startup", "start up", "boot",
    "boots", "reload", "restart", "clear ip ospf process", "first configured", "process is started",
    "ospf first starts", "ospf first start", "first starts", "first started", "process first starts",
    "ospf is started", "ospf is first started", "ospf starts up", "ospf is enabled", "ospf is first enabled",
    "ospf is turned on", "ospf is first turned on", "ospf begins", "process begins", "ospf is first configured",
    "ospf is configured", "router ospf is configured", "router ospf is entered", "process initialises",
    "ospf initialises", "on startup", "at startup", "at start up"
  ],
},
"q2b-metric": {
  _lists: {
    "GEN": ["both", "each", "they"],
    "ONE": ["1", "costs one"],
    "NV": ["", "costs ", "cost ", "gets ", "cost of ", "has a cost of ", "a cost of "],
    "NOT": [
      "0", "0.1", "0.01", "0.001", "0.5", "2", "5", "10", "64", "100", "1000", "10000"
    ],
    "GB": ["{GEN}", "{Bal}"],
  },
  "interface bandwidth": [
    "link bandwidth", "port bandwidth", "interface speed", "link speed", "port speed",
    "speed of the interface", "speed of the link", "bandwidth of the interface",
    "bandwidth of the link", "bandwidth of each interface", "bandwidth of each link",
    "bandwidth of that interface", "bandwidth of that link", "divided by the bandwidth",
    "divided by bandwidth", "divide by the bandwidth", "divide by bandwidth",
    "divided by its bandwidth", "divided by the link", "divided by the speed", "over the bandwidth",
    "over bandwidth", "over the link", "by its bandwidth", "by the bandwidth", "by bandwidth",
    "by the interface", "by the link speed"
  ],
  "sum": [
    "total", "add", "added", "adding", "adds", "summed", "cumulative", "accumulated", "accumulate",
    "combined", "combine", "combines", "combining", "equals", "equal to", "add up", "adds up",
    "added up", "added together", "plus"
  ],
  "outgoing": ["outbound", "exit", "egress", "leaving", "sent out", "send out"],
  "both cost 1": [
    "1 for both", "1 each", "one each", "one for both", "{AN} costs 1 and {BN} costs 1",
    "{AN} is 1 and {BN} is 1", "{GB}~{ONE}", "1 for {Bal}", "one for {Bal}", "1 on {Bal}",
    "{Aal}~no value of its own", ">!{ABal}~{NV}{NOT}"
  ],
  "reference bandwidth": ["reference", "ref", "ref bw", "10^8", "100000000"],
  "100 Mbps": ["100"],
  "minimum of 1": [
    "minimum", "lowest possible", "lowest it can", "lowest cost", "below 1", "less than 1",
    "lower than 1", "smaller than 1", "at least 1", "no lower than", "no less than", "round up",
    "rounded up", "rounds up", "whole number", "integer", "fraction", "fractional", "decimal"
  ],
},
"q2c-multiarea": {
  "LSDB": ["link state database", "link-state database", "database", "topology table"],
  "floods": ["flood", "flooding", "LSA", "LSAs", "updates"],
  "SPF": ["Dijkstra", "recalculate", "recalculation", "recompute"],
  "backbone": ["area 0", "area zero"],
  "ABRs": ["ABR", "area border router", "area border routers", "border router"],
  "only within the area": [
    "only within", "stays within", "kept within", "within each area", "inside each area",
    "only in the area", "only that area", "only in that area", "stays in the area", "stays inside",
    "kept in the area", "confined to the area", "limited to the area", "stays local",
    "contained within", "inside the area", "inside that area", "within the area", "within that area",
    "that one area", "its own area", "own area", "limited to that area", "limited to that one area",
    "only routers in that area", "only routers in the area", "only the routers in that area",
    "only flooded inside", "only flooded within", "only affects that area", "only affects the area",
    "doesn t leave the area", "does not leave the area", "never leaves the area", "kept local",
    "what is in their area", "what is in its area", "in their own area", "within their area",
    "within its area", "only their area", "only its area", "only their own area"
  ],
  "summarise": ["summary", "summarisation", "summarization", "summarize", "aggregate"],
  "smaller routing tables": [
    "smaller tables", "routing tables are smaller", "routing table is smaller", "tables are smaller",
    "fewer routes", "less routes", "fewer routing entries", "reduces the routing table",
    "reduced routing table"
  ],
},
"q2d-timers": {
  _lists: {
    "MATCHF": [
      "must match", "match", "matching", "identical", "mismatch", "mismatched", "same on both",
      "same values", "same timers", "same hello", "same dead", "same intervals", "same settings",
      "set the same", "configured the same", "also set", "also be set", "also change", "agree", "equal",
      "consistent", "same as", "to the same", "hello too", "hello as well", "needs hello", "also needs"
    ],
  },
  "must match": [
    "match", "matching", "identical", "mismatch", "mismatched", "same on both", "same values",
    "same timers", "same hello", "same dead", "same intervals", "same settings", "set the same",
    "configured the same", "also set", "also be set", "also change", "agree", "equal", "consistent",
    "same as", "to the same", "hello too", "hello as well", "needs hello", "also needs"
  ],
  "{dsec}": [
    "{d} seconds", "{d} second", "{d} s", "{d}s", "{d} sec", "{d} secs", "dead {d}",
    "dead interval {d}", "dead timer {d}", "dead to {d}", "dead of {d}", "4 times", "four times", "4x",
    "x4", "4 x", "times 4", "times four", "quadruple"
  ],
  "{nb} must match": [
    "{nb}~{MATCHF}", "{other}~", "R1~", "same on both", "on both routers", "on both ends", "both ends",
    "on both sides", "both neighbours", "both routers", "match on both", "matches on both",
    "hello interval {h}", "hello {h} on {nb}", "hello {h} too", "hello {h} as well"
  ],
  "more overhead": [
    "overhead", "bandwidth", "more traffic", "traffic", "more hellos", "more hello packets",
    "hellos more often", "cpu", "processing"
  ],
  "flapping": [
    "flap", "unstable", "instability", "false", "falsely", "by mistake", "mistakenly", "wrongly",
    "lossy", "packet loss", "lost hellos", "missed hellos"
  ],
  "detect a failure": [
    "detect", "detection", "reconverge", "converge", "convergence", "failover", "notice", "notices",
    "noticed", "spot", "spots", "spotted", "find out", "finds out", "found out", "find a dead",
    "finds a dead", "realise", "realises", "realised", "discover", "discovers", "discovered", "react",
    "reacts", "recover", "recovers", "declared down", "declare it down", "identify", "identifies",
    "identified", "tell when", "tells when", "know when", "knows when", "neighbour goes down",
    "neighbor goes down", "neighbour went down", "neighbour is down", "neighbor is down", "neighbour dies",
    "neighbour has failed", "neighbour fails", "neighbor fails", "router goes down", "link goes down",
    "link is down", "when it goes down"
  ],
  "faster": ["quicker", "quickly", "sooner", "speed", "speeds"],
  "slow links": [
    "slow", "low bandwidth", "unreliable", "congested", "less overhead", "fewer hellos",
    "reduce overhead", "less traffic", "less bandwidth"
  ],
  "4 &times; hello": [
    "4 times", "four times", "4x", "x4", "quadruple", "4 x", "times 4", "times four"
  ],
},
"q2e-roles": {
  "{A} is an ABR": ["{A}~ABR", "{A}~area border router", "{A}~border router", "{OTHER}~"],
  "same area": ["one area", "single area", "a single area"],
  "backbone": ["area 0", "area zero"],
  "two or more areas": [
    "more than one area", "multiple areas", "several areas", "two areas", "connects areas",
    "between areas"
  ],
  "summaries": ["summary", "summarise", "summarises", "type 3"],
  "external": [
    "outside OSPF", "outside the network", "to the outside", "the outside world", "outside world",
    "outside routes", "outside sources", "out of the network", "outside of the network",
    "outside network", "outside networks", "other networks", "another network",
    "another routing protocol", "other routing protocols", "another routing domain", "the Internet",
    "ISP"
  ],
  "redistributes": ["redistribute", "redistribution", "injects", "default-information originate",
    "advertise the external route", "advertise external routes", "advertise the external routes", "advertise outside routes", "advertise the outside route", "advertise routes from outside", "advertise them into OSPF", "advertise it into OSPF", "advertise into OSPF", "advertise those routes into OSPF", "advertise the external network", "advertise external networks"],
  "{B} is an internal router": ["{B}~internal"],
  "{B} is a backbone router": ["{B}~backbone"],
  "{A} is a backbone router": ["{A}~backbone"],
  "{B} is an ASBR": ["{B}~ASBR", "{B}~autonomous system boundary router", "{B}~boundary router"],
  "passes summaries": [
    "summaries", "summary", "summarise", "type 3", "routes between areas", "between areas",
    "between the areas", "connects areas", "connects the areas", "joins areas"
  ],
  "redistributes#2": [
    "advertise the external route", "advertise external routes", "advertise the external routes", "advertise outside routes", "advertise the outside route", "advertise routes from outside", "advertise them into OSPF", "advertise it into OSPF", "advertise into OSPF", "advertise those routes into OSPF", "advertise the external network", "advertise external networks",
    "redistribute", "redistribution", "injects", "imports", "brings in",
    "default-information originate"
  ],
  "outside OSPF#here": [
    "external", "outside network", "outside the network", "to the outside", "the outside world",
    "outside world", "outside routes", "outside sources", "out of the network",
    "outside of the network", "outside networks", "other networks", "another network",
    "another routing protocol", "other routing protocols", "another routing domain", "the Internet",
    "{EXT}"
  ],
},
"q3c-place": {
  _lists: {
    "STDT": [
      "destination", "destinations", "destination router", "close to the destination",
      "closest to the destination", "near the destination", "nearest the destination",
      "nearest to the destination", "next to the destination", "at the destination", "near destination",
      "close to destination"
    ],
    "EXTT": [
      "source", "source router", "close to the source", "closest to the source", "near the source",
      "nearest the source", "nearest to the source", "next to the source", "at the source",
      "near source", "close to source"
    ],
    "PVS": [
      "", "on ", "at ", "in ", "onto ", "to ", "goes on ", "go on ", "goes at ", "goes to ",
      "should be on ", "should be at ", "should be in ", "should be ", "should go on ", "should go at ",
      "should go ", "would go on ", "would go at ", "would be on ", "is on ", "is at ", "belongs on ",
      "belongs at ", "belongs ", "must be on ", "must go on ", "needs to be on ", "needs to go on ",
      "is applied on ", "is applied to ", "is placed on ", "is placed at ", "is put on ", "can go on ",
      "is best on ", "is best at ", "is best placed on ", "is best placed at ", "is better on ",
      "is better at ", "ought to be on ", "has to be on ", "has to go on ", "be applied on ",
      "be applied to ", "be placed on ", "be placed at ", "be put on ", "should be applied on ",
      "should be applied to ", "should be placed on ", "should be placed at ", "should be put on ",
      "would be applied on ", "would be placed on ", "is applied at ", "goes onto ", "apply it on ",
      "apply it to ", "put it on ", "place it on ", "it goes on ", "it should go on ", "it belongs on ",
      "it should be on ", "it goes at ", "it should go at "
    ],
    "PVR": [
      "on", "at", "in", "onto", "to", "goes on", "go on", "goes at", "goes to", "should be on",
      "should be at", "should be in", "should be", "should go on", "should go at", "should go",
      "would go on", "would go at", "would be on", "is on", "is at", "belongs on", "belongs at",
      "belongs", "must be on", "must go on", "needs to be on", "needs to go on", "is applied on",
      "is applied to", "is placed on", "is placed at", "is put on", "can go on", "is best on",
      "is best at", "is best placed on", "is best placed at", "is better on", "is better at",
      "ought to be on", "has to be on", "has to go on", "be applied on", "be applied to", "be placed on",
      "be placed at", "be put on", "should be applied on", "should be applied to", "should be placed on",
      "should be placed at", "should be put on", "would be applied on", "would be placed on",
      "is applied at", "goes onto", "apply it on", "apply it to", "put it on", "place it on",
      "it goes on", "it should go on", "it belongs on", "it should be on", "it goes at",
      "it should go at"
    ],
    "STDN": [
      "standard", "standard ACL", "standard ACLs", "standard one", "standard list",
      "standard access list"
    ],
    "EXTN": [
      "extended", "extended ACL", "extended ACLs", "extended one", "extended list",
      "extended access list"
    ],
    "STDNEAR": [
      "close to the destination", "closest to the destination", "near the destination",
      "next to the destination", "at the destination", "near the servers", "close to the servers"
    ],
    "EXTNEAR": [
      "close to the source", "closest to the source", "near the source", "next to the source",
      "at the source", "near the {A} LAN", "close to the {A} hosts"
    ],
    "HAS": [
      "should have", "has", "gets", "should get", "needs", "should hold", "takes", "should take"
    ],
    "IT": [
      "it should be on", "it should be applied on", "it should be applied to", "it should go on",
      "it should go at", "it should be at", "it should be placed on", "it should be placed at",
      "it should be put on", "it belongs on", "it belongs at", "it should move to",
      "it should be moved to", "move it to", "moved it to", "it needs to be on", "it needs to go on",
      "it must be on", "it must go on", "put it on", "place it on", "apply it on"
    ],
    "LOSTV": [
      "loses", "lose", "lost", "loses access to", "lose access to", "cannot reach", "can't reach",
      "can not reach", "unable to reach", "blocked from", "blocks", "also blocks", "is blocked from",
      "denied access to", "no access to", "no longer reach", "no longer reaches", "can no longer get to",
      "no longer get to", "no longer gets to", "can t get to", "cannot get to", "can not get to", "from"
    ],
    "LOSTW": [
      "every destination", "all destinations", "every other network", "all other networks",
      "everything beyond"
    ],
    "BL": ["{B} LAN", "the {B} LAN", "{B}"],
  },
  "standard ACL close to the destination": ["standard~{STDT}"],
  "extended ACL close to the source": ["extended~{EXTT}"],
  "also loses the {B} LAN": ["{LOSTV} {BL}", "{LOSTW}"],
  "standard ACL on {dst}": [
    "{STDN} {PVS}{dst}", "{STDN} {PVR} router {dst}", "standard~{STDNEAR}",
    "{dst} {HAS} the standard ACL", "{dst} {HAS} the standard", "{IT} {dst}"
  ],
  "extended ACL on {src}": [
    "{EXTN} {PVS}{src}", "{EXTN} {PVR} router {src}", "extended~{EXTNEAR}",
    "{src} {HAS} the extended ACL", "{src} {HAS} the extended"
  ],
  "only matches the source": [
    "source only", "only the source", "only source", "only on the source", "only by the source",
    "just the source", "only check the source", "only checks the source", "only match the source",
    "only filter on the source", "only filter by the source", "only filter by source",
    "only look at the source", "only looks at the source", "only examine the source",
    "only read the source", "only see the source", "only use the source", "only uses the source",
    "only care about the source", "only based on the source",
    "only filter traffic based on the source", "only filter based on the source",
    "source address only", "source ip only", "can not check the destination",
    "cannot check the destination", "can't check the destination", "cannot see the destination",
    "can't see the destination"
  ],
  "destination, protocol and port": [
    "source, destination, protocol", "destination and port", "destination and protocol",
    "protocol and port", "protocol or port", "port and protocol", "port or protocol", "protocol, port",
    "tcp or udp port", "source and destination", "destination and source", "destination as well",
    "destination too", "destination address and port", "destination address as well"
  ],
  "before it wastes bandwidth": [
    "wastes bandwidth", "wasting bandwidth", "waste bandwidth", "wasted bandwidth", "saves bandwidth",
    "save bandwidth", "saving bandwidth", "before it crosses the network", "before it crosses",
    "before it travels", "before it reaches the rest of the network", "before it uses",
    "unnecessary traffic", "unwanted traffic is dropped early", "dropped before it",
    "reduces network traffic", "reduce network traffic", "reducing network traffic", "less network traffic",
    "reduces traffic", "reduce traffic", "reducing traffic", "less traffic", "lowers traffic",
    "cuts down traffic", "cuts down on traffic", "saves traffic", "reduces the load", "reduces load",
    "reduces congestion", "less congestion", "bandwidth"
  ],
},
"q3d-established": {
  _lists: {
    "LET": [
      "allows", "allow", "allowed", "lets in", "let in", "permits", "permit", "permitted", "accepts",
      "accept"
    ],
    "STOP": [
      "blocks", "block", "blocked", "denies", "deny", "denied", "drops", "drop", "dropped", "stops",
      "stop", "rejects", "reject"
    ],
    "RET": [
      "return traffic", "replies", "reply", "responses", "response", "return packets",
      "returning traffic"
    ],
    "NEW": [
      "new connections", "new sessions", "new connection", "new session",
      "connections initiated by outside", "connections started by outside", "connections from outside",
      "connections from the outside", "sessions from outside"
    ],
  },
  "ACK or RST": ["ACK", "RST", "acknowledgement", "ACK bit", "ACK flag"],
  "started by inside hosts": [
    "initiated from inside", "started from inside", "opened from inside", "inside hosts initiated",
    "began inside", "begun inside", "began from inside", "that began inside", "inside hosts started",
    "inside hosts opened", "initiated by inside", "started by inside", "opened by inside",
    "initiated by the inside", "started by the inside", "inside initiated", "inside-initiated",
    "internal hosts initiated", "started by internal", "initiated by internal",
    "initiated by a host inside", "started by a host inside", "initiated by hosts inside",
    "started by hosts inside", "initiated by an inside", "started by an inside", "started internally",
    "internally started", "initiated internally", "internally initiated", "started on the inside",
    "initiated on the inside", "started within", "initiated within", "started from within",
    "initiated from within", "we started", "we initiated", "started by us", "initiated by us",
    "you started", "you initiated", "already started", "already initiated", "previously started",
    "previously initiated", "started by the internal", "initiated by the internal",
    "started from the inside", "initiated from the inside", "started by the user",
    "initiated by the user", "user started", "user initiated", "started by the host",
    "initiated by the host", "inside started", "internal started", "started by the local",
    "initiated by the local", "started locally", "initiated locally", "started inside",
    "initiated inside", "started on the inside network", "started from the inside network",
    "started internally", "started by internal devices", "initiated by internal devices",
    "started by the internal devices"
  ],
  "not stateful": [
    "stateless", "not a stateful", "no state", "does not track", "doesn't track", "not track",
    "not a firewall", "faked", "forged ACK", "spoofed ACK", "faked ACK", "fake ACK", "crafted ACK"
  ],
  "return traffic#dir": [
    "replies", "reply", "returning", "responses", "response", "return packets", "back in", "respond",
    "responds", "responding", "can only respond", "come back in", "comes back in", "coming back in",
    "let back in", "allowed back in", "traffic back", "@!{STOP}~{RET}"
  ],
  "new connections#dir": [
    "new sessions", "new TCP", "new connection", "new session", "start the connection",
    "start a connection", "starts the connection", "starts a connection", "starting connections",
    "starting a connection", "starting the connection", "start connections", "starts connections",
    "start new connections", "starting new connections", "connection attempts", "connection requests",
    "incoming connections", "started from outside", "started by outside", "initiated from outside",
    "initiated by outside", "started from the outside", "initiated from the outside",
    "started by an outside", "initiated by an outside", "started by the outside",
    "initiated by the outside", "outside-initiated", "outside initiated", "SYN", "@!{LET}~{NEW}"
  ],
},
"q3e-acl6": {
  _lists: {
    "NDT": [
      "neighbour discovery", "neighbor discovery", "ND", "NDP", "NS", "NA", "neighbour solicitation",
      "neighbor solicitation", "neighbour advertisement", "neighbor advertisement"
    ],
    "NDP": [
      "permit {NDT}", "allow {NDT}", "permit for {NDT}", "allow for {NDT}", "{NDT} is permitted",
      "{NDT} is allowed", "{NDT} are permitted", "{NDT} are allowed", "{NDT} permitted", "{NDT} allowed",
      "{NDT} still works", "{NDT} keeps working"
    ],
  },
  "always named": [
    "only named", "are named", "is named", "must be named", "named list", "named ACL",
    "named access list", "named not numbered", "named rather than numbered",
    "named instead of numbered", "not numbered", "no numbered", "given a name", "identified by name",
    "use a name", "use names", "^named", "named only", "only names", "named yes",
    "names rather than numbers", "names not numbers", "names instead of numbers",
    "name rather than a number", "name not a number"
  ],
  "extended ACL": [
    "extended style", "like extended", "source and destination", "source destination",
    "destination and source", "source plus destination", "protocol and source", "protocol source",
    "protocol plus source", "protocol plus the two addresses", "protocol and both addresses",
    "protocol and the addresses", "protocol and addresses", "match on protocol", "matches on protocol",
    "source/destination", "source and destination addresses"
  ],
  "prefix length": [
    "prefix-length", "/64", "prefix", "CIDR", "slash notation", "no wildcard", "without wildcard"
  ],
  "traffic-filter": ["traffic filter"],
  "implicit permits for neighbour discovery": [
    "@{NDP}", "not block {NDT}", "@solicitation and advertisement are permitted",
    "@solicitation and advertisement are allowed", "@solicitation and advertisement still work"
  ],
},
"q4b-static": {
  _lists: {
    "SF": [
      "sends first", "sends traffic first", "sends traffic out first", "sends out first",
      "goes out first", "traffic goes out first", "starts traffic", "starts conversation",
      "starts connection", "starts first", "initiates", "initiated", "initiate", "outbound traffic",
      "outbound connection", "originates", "first contact"
    ],
    "OUTS": [
      "outside", "outside host", "outside hosts", "outside users", "outside user", "outside devices",
      "external hosts", "external users", "internet hosts", "the internet", "the outside"
    ],
  },
  "one-to-one": [
    "one to one", "1 to 1", "1:1", "permanent mapping", "permanently maps", "permanently map",
    "permanently mapped", "static mapping", "fixed mapping", "one fixed", "one public address",
    "one for one"
  ],
  "reachable from outside": [
    "reachable from outside", "reachable from the internet", "accessible from outside",
    "accessible from the internet", "from the internet", "from outside", "connect to",
    "people outside", "outside users", "outside hosts", "external users", "inbound", "can reach",
    "reach it", "access it"
  ],
  "server": ["servers", "web server", "mail server"],
  "sends first": [
    "sends traffic first", "sends traffic out first", "sends out first", "goes out first",
    "traffic goes out first", "starts traffic", "starts conversation", "starts connection",
    "starts first", "initiates", "initiated", "initiate", "outbound traffic", "outbound connection",
    "originates", "first contact", "@!{OUTS}~{SF}"
  ],
  "fixed public address": [
    "permanent public address", "permanent address", "static address", "same public address",
    "same public IP", "same address", "same IP", "fixed address", "fixed IP", "known address",
    "never changes", "does not change", "stays the same", "where to find it"
  ],
  "times out": [
    "time out", "timeout", "expire", "expires", "expired", "temporary", "temporarily", "released",
    "returned to the pool", "may be different", "might be different", "could be different",
    "different next time", "different address", "address changes", "could change", "can change",
    "would change", "might change", "may change", "not fixed", "not permanent"
  ],
  "reach the {srvn}": [
    "reachable from outside", "reachable from the internet", "accessible from outside",
    "accessible from the internet", "from the internet", "from outside", "connect to",
    "people outside", "outside users", "outside hosts", "external users", "inbound", "can reach",
    "reach it", "access it"
  ],
},
"q4c-howmany": {
  _lists: {
    "PATS": ["PAT", "overload"],
    "PT": [
      "only one", "just one", "single", "1", "one address", "one public address", "one ip",
      "one public ip", "only 1"
    ],
    "NUMS": ["one", "1", "single"],
    "THINGS": [
      "address", "public address", "ip", "public ip", "ip address", "public ip address"
    ],
    "PREPS": ["with", "for", "using", "via"],
    "DYNS": ["dynamic NAT", "DNAT", "dynamic", "NAT", "NAT pool", "pool"],
    "PERHOST": [
      "needs one address per host", "needs one per host", "needs an address per host",
      "needs one address for each host", "needs one for each host", "one address per host",
      "one per host", "an address per host", "one address for each host", "one for each host",
      "address for each host", "address per host"
    ],
    "DV": ["needs", "need", "requires", "require", "uses", "is", "would need", "will need"],
    "DT": ["", "addresses ", "public addresses ", "ip addresses "],
    "DPR": ["for", "with", "in"],
    "DN": ["DNAT", "dynamic NAT"],
    "DH": [
      "per host", "each host", "every host", "for each", "same time", "simultaneous", "at once",
      "concurrent", "as many", "active devices", "active hosts", "devices online", "hosts online",
      "online at once", "in use at once", "per device", "each device", "every device", "per active"
    ],
    "DNS": ["dynamic NAT", "DNAT", "dynamic", "NAT"],
  },
  "port number": ["port numbers", "ports", "port"],
  "can't": [
    "cannot", "fail", "denied", "dropped", "wait", "unable", "blocked", "no translation"
  ],
  "its own public address": [
    "own public address", "own address", "own public ip", "own ip", "one-to-one", "one to one", "1:1",
    "1 to 1", "at the same time", "simultaneously", "at once", "concurrently", "same time"
  ],
  "Dynamic NAT needs one address per host online at the same time": [
    "dynamic NAT~per host", "dynamic NAT~each host", "dynamic NAT~every host", "dynamic NAT~for each",
    "dynamic NAT~same time", "dynamic NAT~simultaneous", "dynamic NAT~at once",
    "dynamic NAT~concurrent", "dynamic NAT~as many", "{DN}~{DH}"
  ],
  "its own public address#2": [
    "own public address", "own address", "own public ip", "own ip", "one-to-one", "one to one", "1:1",
    "1 to 1"
  ],
  "PAT needs only one": [
    "{PATS}~{PT}", "{NUMS} {PREPS} {PATS}", "{NUMS} {THINGS} {PREPS} {PATS}", "{DYNS}~",
    "@!{PATS}~{PERHOST}"
  ],
  "PAT needs only one#m": [
    "{PATS}~{PT}", "{NUMS} {PREPS} {PATS}", "{NUMS} {THINGS} {PREPS} {PATS}", "{DYNS}~",
    "@!{PATS}~{PERHOST}", "@!{PATS}~{m}"
  ],
  "dynamic NAT needs {m}": [
    "dynamic NAT {DV} {m}", "{m} {DT}{DPR} dynamic NAT", "{m} for NAT", "{m} addresses for NAT",
    "{m} public addresses for NAT", "{m} with NAT", "{m} public addresses", "{m} addresses",
    "{m} public IPs", "{m} public ip addresses", "{DNS}~{m}", "{PATS}~"
  ],
},
"q4d-patport": {
  _lists: {
    "KEEP": ["keeps", "stays", "retains", "unchanged", "{n}"],
    "MOVE": [
      "different port", "new port", "another port", "next available port", "other port", "unique port",
      "free port", "changed", "changes", "translated port", "{n1}", "1024"
    ],
  },
  "translation table": [
    "NAT table", "PAT table", "translations table", "table entry", "unique combination", "unique pair",
    "address and port", "IP and port", "socket"
  ],
  "keeps its port": [
    "first keeps", "first one keeps", "first user keeps", "first host keeps", "first connection keeps",
    "first session keeps", "keeps the port", "keeps its original port", "keeps its source port",
    "gets the port", "gets its port", "gets to keep"
  ],
  "assigns a different port": [
    "different port", "new port", "another port", "next available port", "unique port",
    "changes the port", "translates the port to", "translates the source port to", "other port", "free port", "port is changed",
    "port translation"
  ],
  "translates them back": [
    "translate back", "translated back", "translates the reply back", "translates replies back",
    "translates it back", "maps back", "maps it back", "changes it back", "reverse translation",
    "back to the original port", "back to its original port",
    "translates the port back", "translates the source port back", "translates the ports back",
    "translates the address back", "port back to"
  ],
  "{F} keeps port {n}": ["{FS}~{KEEP}"],
  "{L} gets a different port": ["{LS}~{MOVE}"],
  "translates it back": [
    "translate back", "translated back", "translates the reply back", "translates replies back",
    "translates them back", "maps back", "maps it back", "changes it back", "reverse translation",
    "back to port {n}", "back to the original port", "back to its original port",
    "translates the port back", "translates the source port back", "translates the ports back",
    "translates the address back", "port back to"
  ],
},
"q5a-dora": {
  "Discover": [
    "DHCPDISCOVER", "find the DHCP server", "find a DHCP server", "find DHCP server", "find the server",
    "find a server", "finds the DHCP server", "finds a DHCP server", "to find the DHCP", "to find a DHCP",
    "looking for a DHCP server", "looking for the DHCP server", "looks for a DHCP server",
    "search for a DHCP server", "searches for a DHCP server", "locate a DHCP server", "locate the DHCP server"
  ],
  "broadcasts": [
    "broadcast", "broadcasted", "255.255.255.255", "all-ones address", "sent to everyone",
    "to every device on the LAN", "to all devices on the LAN", "to all hosts"
  ],
  "Offer": ["DHCPOFFER"],
  "Request": ["DHCPREQUEST", "!ARP~request", "!DNS~request", "!ARP~requests", "!DNS~requests"],
  "Acknowledgement": ["DHCPACK", "ACK", "acknowledge", "acknowledges"],
  "lease": [
    "leases", "leased", "lease period", "lease time", "lease expires", "address expires",
    "renew the lease", "renews the lease", "renew its lease", "renews its lease", "lease renewal",
    "for a set time", "for a limited time", "limited time", "for a set period"
  ],
  "Discover, Offer, Request, Acknowledgement": [
    "DORA",
    "<discover/dhcpdiscover/find/locate/look/search..offer/dhcpoffer..request/dhcprequest..acknowledgement/acknowledgment/acknowledge/acknowledges/ack/dhcpack"
  ],
},
"q5b-relay": {
  _lists: {
    "IFF": [
      "G0/{n}", "Gi0/{n}", "Gig0/{n}", "GigabitEthernet0/{n}", "GigabitEthernet 0/{n}", "LAN interface",
      "interface facing the PCs", "PC-facing interface", "client-facing interface",
      "interface facing the clients"
    ],
  },
  "broadcast": ["broadcasts", "broadcasted", "broadcasting"],
  "routers do not forward broadcasts": [
    "do not pass on", "doesn t pass on", "don t pass on", "not pass on", "t pass on",
    "stops at the router", "stop at the router", "stops at", "stop at", "do not forward",
    "not forward", "t forward", "never forward", "not cross", "t cross", "not pass through",
    "t pass through", "block broadcast", "blocks broadcast", "drop broadcast", "drops broadcast",
    "stop broadcast", "stops broadcast", "t get forward", "not get forward", "t be forward",
    "not be forward", "isn t forward", "aren t forward", "is blocked", "are blocked", "get blocked",
    "gets blocked", "blocked by", "blocked at", "is dropped", "are dropped", "get dropped",
    "gets dropped", "dropped by", "dropped at", "stay on the LAN", "stays on the LAN",
    "stay in the LAN", "stays in the LAN", "stay on the local", "stays on the local",
    "stay in the local", "stays in the local", "stay local", "stays local", "not leave", "never leave",
    "t leave"
  ],
  "DHCP relay": ["relay", "relays", "relay agent", "relaying"],
  "unicast": ["unicasts", "unicasted", "unicasting"],
  "same subnet": [
    "same network", "same LAN", "same broadcast domain", "local subnet", "local network",
    "same segment", "same VLAN"
  ],
  "ip helper-address": ["helper-address", "helper address", "ip helper", "helper"],
  "{gw} {ifc}": ["{gw}~{IFF}", "{OTHERS}~"],
},
"q5c-exclude": {
  "static": [
    "statically", "manually", "manual", "fixed", "hard-coded", "hardcoded", "by hand"
  ],
  "default gateway": [
    "gateway", "router interface", "router's interface", "router address", "router's address",
    "router's IP", "gateway address"
  ],
  "printers and servers": [
    "printers", "printer", "file server", "web server", "DNS server", "mail server", "email server",
    "switch management", "management address", "management IP", "and servers", "or servers",
    "like servers", "such as servers", "static server", "server's address", "server's IP", "servers"
  ],
  "conflict": [
    "conflicts", "duplicate", "clash", "same address", "same IP", "already in use", "already used",
    "already assigned", "already taken", "overlap", "overlapping", "overlaps"
  ],
},
"q6-roas": {
  _lists: {
    "LINK": [
      "in", "to", "=", "is in", "are in", "should be in", "must be in", "needs to be in", "goes in",
      "goes into", "belongs in", "belongs to", "put in", "placed in", "assigned to", "is assigned to",
      "should be assigned to", "is", "access", "->"
    ],
    "VLINK": [
      "in", "to", "is in", "are in", "should be in", "must be in", "needs to be in", "goes in",
      "goes into", "belongs in", "belongs to", "put in", "placed in", "assigned to", "is assigned to",
      "should be assigned to"
    ],
    "PS1": [
      "Fa0/1", "F0/1", "Fa 0/1", "FastEthernet0/1", "FastEthernet 0/1", "H1", "port 1"
    ],
    "PS2": [
      "Fa0/2", "F0/2", "Fa 0/2", "FastEthernet0/2", "FastEthernet 0/2", "H2", "port 2"
    ],
    "AP": [
      "access vlan", "access vlans", "assign vlan", "assign vlans", "assigned vlan", "assigned vlans",
      "assign them to vlan", "assign them to vlans", "assigned to vlan", "assigned to vlans", "put in vlan",
      "put in vlans", "put them in vlan", "put them in vlans", "ports in vlan", "ports in vlans",
      "hosts in vlan", "hosts in vlans", "ports to vlan", "ports to vlans", "interfaces in vlan",
      "interfaces to vlan"
    ],
    "AV": ["VLAN ", ""],
  },
  "Fa0/1 in VLAN {x}": [
    "<access vlan {x}..access vlan {y}", "<vlan {x} to..vlan {y} to",
    "{AP} {x} and {AV}{y}",
    "{PS1} {LINK} VLAN {x}", "{PS1} {LINK} vlan{x}", "{PS1} switchport access vlan {x}",
    "{PS1} vlan {x}", "VLAN {x} on {PS1}", "VLAN {x} for {PS1}", "VLAN {x} to {PS1}",
    "switchport access vlan {x} on {PS1}", "!{PS1} {VLINK} VLAN {y}", "!VLAN {y} on {PS1}",
    "!VLAN {y} for {PS1}", "!VLAN {y} to {PS1}", "!switchport access vlan {y} on {PS1}",
    "!{PS1} switchport access vlan {y}"
  ],
  "Fa0/2 in VLAN {y}": [
    "<access vlan {x}..access vlan {y}", "<vlan {x} to..vlan {y} to",
    "{AP} {x} and {AV}{y}",
    "{PS2} {LINK} VLAN {y}", "{PS2} {LINK} vlan{y}", "{PS2} switchport access vlan {y}",
    "{PS2} vlan {y}", "VLAN {y} on {PS2}", "VLAN {y} for {PS2}", "VLAN {y} to {PS2}",
    "switchport access vlan {y} on {PS2}", "!{PS2} {VLINK} VLAN {x}", "!VLAN {x} on {PS2}",
    "!VLAN {x} for {PS2}", "!VLAN {x} to {PS2}", "!switchport access vlan {x} on {PS2}",
    "!{PS2} switchport access vlan {x}"
  ],
  "default VLAN 1": [
    "VLAN 1", "vlan1", "default VLAN", "native VLAN", "no VLAN", "not assigned", "never assigned",
    "unassigned", "never given a vlan", "not given a vlan", "never put in a vlan", "not put in a vlan",
    "without a vlan", "no vlan assigned", "no access vlan"
  ],
  "no subinterface for VLAN 1": [
    "no subinterface for it", "no subinterface for them", "no subinterface for the native VLAN",
    "no subinterface for the default VLAN", "only has subinterfaces for", "only subinterfaces for",
    "only has dot1q subinterfaces for", "only dot1q subinterfaces for", "only has sub-interfaces for",
    "can t route VLAN 1", "cannot route VLAN 1", "can not route VLAN 1", "can t route them",
    "cannot route them", "can t route VLAN 1 frames", "have a subinterface for VLAN 1",
    "subinterface for VLAN 1", "subinterface for the default VLAN", "no encapsulation dot1q 1",
    "no interface for VLAN 1", "no gateway for VLAN 1", "no router interface for VLAN 1",
    "VLAN 1 is not configured on the router", "VLAN 1 isn't configured on the router",
    "doesn't know about VLAN 1", "does not know about VLAN 1"
  ],
  "can't reach its gateway": [
    "can t reach its gateway", "cannot reach its gateway", "can not reach its gateway", "can t reach the gateway",
    "cannot reach the gateway", "can t reach their gateway", "cannot reach their gateway", "can t reach the default gateway",
    "cannot reach the default gateway", "can t get to the gateway", "can t get to its gateway", "no way to reach the gateway",
    "gateway is unreachable", "gateway unreachable", "can t reach R1", "cannot reach R1", "can t reach the router",
    "cannot reach the router", "never reach R1", "never reaches R1", "never reach the router", "don t reach R1",
    "doesn t reach R1", "can t be routed", "cannot be routed", "can t route", "cannot route", "isn t routed", "not routed"
  ],
  "Gi0/1 is not a trunk": [
    "not a trunk", "isn t a trunk", "is not a trunk", "not trunking", "isn t trunking", "not set to trunk",
    "not set as a trunk", "not in trunk mode", "should be a trunk", "needs to be a trunk", "should be trunk",
    "should be trunked", "needs to be trunked", "no trunk", "trunk is missing", "missing trunk", "missing the trunk",
    "is an access port", "set to access", "set as access", "mode access on gi0/1", "gi0/1 is access",
    "gi0/1 is in access mode", "access instead of trunk", "access mode instead of trunk"
  ],
  "only carries one VLAN": [
    "one VLAN", "single VLAN", "only VLAN 1", "only carries VLAN 1", "untagged", "doesn t carry", "can t carry",
    "won t carry", "does not carry", "cannot carry", "only one vlan", "tags are dropped", "tagged frames",
    "drops the tags", "drops tagged", "can t pass", "won t pass", "doesn t pass", "only passes"
  ],
  "switchport mode trunk": ["mode trunk", "make it a trunk", "set it to trunk", "change it to trunk", "trunk mode", "set gi0/1 to trunk"],
  "Gi0/0 is shut down": [
    "shut down", "shutdown", "is shut", "is down", "administratively down", "admin down", "not enabled",
    "never enabled", "isn t enabled", "never brought up", "not brought up", "no no shutdown", "missing no shutdown",
    "missing the no shutdown", "forgot no shutdown", "disabled", "turned off", "not turned on", "never turned on"
  ],
  "subinterfaces go down with it": [
    "subinterfaces are down", "subinterfaces go down", "subinterfaces down", "subinterfaces stay down",
    "sub-interfaces are down", "sub interfaces are down", "subinterfaces can t come up", "subinterfaces won t come up",
    "subinterfaces don t work", "subinterfaces won t work", "subinterfaces are also down", "subinterfaces depend",
    "subinterfaces need", "subinterfaces rely", "all the subinterfaces", "both subinterfaces"
  ],
  "no shutdown": ["no shut", "bring it up", "enable gi0/0", "enable the interface", "turn it on"],
  "the subinterface tags the wrong VLAN": [
    "dot1q {z}", "encapsulation dot1q {z}", "wrong tag", "wrong vlan tag", "wrong encapsulation", "wrong dot1q",
    "tagged {z}", "tags {z}", "tags vlan {z}", "vlan {z} instead of", "{z} instead of {y}", "tag should be {y}",
    "should be dot1q {y}", "wrong vlan number", "mismatched vlan", "vlan mismatch", "encapsulation is wrong",
    "encapsulation is incorrect", "wrong vlan on the subinterface", "subinterface has the wrong vlan"
  ],
  "encapsulation dot1q {y}": ["dot1q {y}", "encapsulation dot1q {y}", "encapsulation dot1Q {y}", "change the tag to {y}", "tag {y}"],
  "the subinterface is in the wrong subnet": [
    "wrong subnet", "wrong ip", "wrong ip address", "wrong address", "192.168.{w}.1", "{w}.1", "different subnet",
    "wrong network", "should be 192.168.{y}.1", "incorrect ip", "incorrect address", "ip is wrong", "address is wrong",
    "ip address is wrong", "ip address is incorrect", "not in 192.168.{y}"
  ],
  "ip address 192.168.{y}.1 255.255.255.0": [
    "ip address 192.168.{y}.1", "192.168.{y}.1 255.255.255.0", "change the ip to 192.168.{y}.1",
    "change it to 192.168.{y}.1", "set it to 192.168.{y}.1", "readdress", "re-address"
  ],
  "the ports in each other's VLANs": [
    "swapped", "switched around", "swapped around", "the wrong way round", "the wrong way around", "wrong way round",
    "wrong way around", "each other s VLAN", "each other s VLANs", "each others VLAN", "each others VLANs", "reversed",
    "mixed up", "back to front", "the other way round", "the other way around", "fa0/1 is in vlan {y}",
    "fa0/2 is in vlan {x}", "h1 is in vlan {y}", "h2 is in vlan {x}", "wrong vlans", "in the wrong vlan",
    "opposite vlans", "opposite vlan"
  ],
  "switchport access vlan {x}#s1": ["access vlan {x}", "fa0/1 to vlan {x}", "fa0/1 in vlan {x}", "h1 in vlan {x}", "h1 to vlan {x}", "fa0/1 into vlan {x}"],
  "switchport access vlan {y}#s2": ["access vlan {y}", "fa0/2 to vlan {y}", "fa0/2 in vlan {y}", "h2 in vlan {y}", "h2 to vlan {y}", "fa0/2 into vlan {y}"],
  "H2's default gateway is wrong": [
    "wrong gateway", "wrong default gateway", "gateway is wrong", "gateway is incorrect", "incorrect gateway",
    "incorrect default gateway", "gateway should be", "gateway is {bad}", "gateway of {bad}", "gateway set to {bad}",
    "{bad}", "default gateway is wrong", "default gateway is incorrect", "bad gateway", "wrong default-gateway",
    "gateway is set wrong", "gateway isn t", "gateway is not"
  ],
  "there is no router at {bad}": [
    "not a router", "isn t a router", "is not a router", "no router", "doesn t exist", "does not exist",
    "nothing at", "not R1", "isn t R1", "no device", "nobody", "no one", "goes nowhere", "go nowhere",
    "isn t the router", "is not the router", "wrong place", "never reach R1", "never reaches R1",
    "can t reach R1", "cannot reach R1", "can t reach the router", "can t send", "can t reply", "cannot reply"
  ],
  "set the default gateway to 192.168.{y}.1": [
    "gateway to 192.168.{y}.1", "gateway 192.168.{y}.1", "192.168.{y}.1", "gateway should be 192.168.{y}.1",
    "change the gateway", "change the default gateway", "set the gateway", "set the default gateway",
    "fix the gateway", "correct the gateway", "update the gateway"
  ],
  "switchport access vlan": [
    "access vlan", "switchport access", "assign the VLAN", "assign VLANs", "assign the ports",
    "assign the port", "assign each port", "assign fa0/1", "assign fa0/2", "assign them to",
    "put them in", "set the access vlan", "set the vlan"
  ],
},
"q2f-lsa": {
  _lists: {
    "IN_AREA": [
      "only within its area", "within its area", "within the area", "within their area",
      "within their own area", "within its own area", "within own area", "within an area",
      "inside its area", "inside the area", "inside their area", "inside their own area",
      "inside its own area", "inside an area", "stays in the area", "stay in the area",
      "stays in its area", "stay in their area", "stays in its own area", "stay in their own area",
      "stays in area", "stay in area", "in its own area", "in their own area", "in the same area",
      "in own area", "its own area", "their own area", "own area", "its area", "their area", "same area",
      "local to the area", "local to its area", "local", "locally", "area only", "in the area",
      "in an area", "intra-area", "intra area", "never leave", "never leaves", "do not leave",
      "does not leave", "don t leave", "doesn t leave", "never leave the area", "never leaves the area",
      "does not leave the area", "do not leave the area", "not sent outside", "never sent outside",
      "not sent out of", "not flooded outside", "never flooded outside", "not flooded beyond",
      "not passed outside", "not passed to other areas", "not sent to other areas",
      "never sent to other areas"
    ],
    "BETWEEN": [
      "between areas", "between the areas", "between different areas", "between two areas",
      "between multiple areas", "into other areas", "into another area", "into the other areas",
      "into the next area", "into neighbouring areas", "into adjacent areas", "into a different area",
      "into different areas", "to other areas", "to another area", "to different areas",
      "to all other areas", "out to other areas", "other areas", "another area", "different areas",
      "a different area", "across areas", "across area boundaries", "across the area boundary",
      "area boundaries", "area boundary", "inter-area", "interarea", "inter area", "into the backbone",
      "to the backbone", "into area 0", "to area 0", "from one area to another", "one area to another",
      "one area into another", "one area to the next", "outside the area", "outside its area",
      "outside of the area", "beyond the area", "beyond its area", "into the rest of the network",
      "the other areas", "all other areas", "the next area", "neighbouring areas", "adjacent areas"
    ],
    "OUTSIDE": [
      "outside OSPF", "outside of OSPF", "outside the OSPF", "outside the autonomous system",
      "outside the network", "outside the domain", "outside the routing domain", "external routes",
      "external networks", "external route", "external network", "external prefixes",
      "external destinations", "routes from outside", "routes outside", "from outside", "non-OSPF",
      "not OSPF", "another routing protocol", "other routing protocols", "different routing protocol",
      "another protocol", "other protocols", "redistributed", "redistribute", "redistribution",
      "redistributing", "from the ISP", "the ISP", "ISP", "internet", "default route", "static routes",
      "another autonomous system"
    ],
    "ASBR_REACH": [
      "where the ASBR is", "where the ASBR can be found", "find the ASBR", "finding the ASBR",
      "locate the ASBR", "locating the ASBR", "reach the ASBR", "reaching the ASBR", "reach an ASBR",
      "get to the ASBR", "route to the ASBR", "path to the ASBR", "way to the ASBR",
      "location of the ASBR", "ASBR location", "ASBR reachability", "how to reach the ASBR",
      "how to get to the ASBR", "where to find the ASBR", "about the ASBR", "advertises the ASBR",
      "advertise the ASBR", "the ASBR itself", "ASBR can be reached"
    ],
    "EVERY_ROUTER": [
      "every router", "each router", "all routers", "every OSPF router", "each OSPF router",
      "all OSPF routers", "any router", "every router in the area", "all routers in the area",
      "every router in that area", "routers in the area", "routers in the same area",
      "routers in that area", "routers within the area", "routers in its area", "routers in an area",
      "routers in each area", "every single router", "each router itself", "the router itself",
      "router itself", "every router in an area", "every one of the routers", "all of the routers",
      "all the routers", "every router within the area", "each router in the area",
      "each router in the same area", "routers in same area", "all routers within the area", "routers",
      "by routers", "by all routers", "by every router", "all router", "every routers",
      "each of the routers"
    ],
    "DR": ["DR", "designated router"],
    "ABR": ["ABR", "area border router"],
    "ASBR": [
      "ASBR", "AS boundary router", "autonomous system boundary router", "boundary router",
      "redistributing router", "router that redistributes", "router redistributing"
    ],
    "EVERY_AREA": [
      "every area", "all areas", "all the areas", "all other areas", "all normal areas",
      "every normal area", "every other area", "every non-stub area", "all non-stub areas",
      "all regular areas", "every regular area", "whole OSPF domain", "entire OSPF domain",
      "whole OSPF network", "entire OSPF network", "whole domain", "entire domain", "whole network",
      "entire network", "whole autonomous system", "entire autonomous system",
      "throughout the autonomous system", "throughout OSPF", "throughout the domain",
      "throughout the network", "all of OSPF", "whole of OSPF", "all OSPF areas", "every OSPF area",
      "everywhere", "whole AS", "entire AS", "throughout the AS"
    ],
    "S1": ["type 1", "LSA 1", "1", "type1", "lsa1", "router LSA"],
    "S2": ["type 2", "LSA 2", "2", "type2", "lsa2", "network LSA"],
    "S3": ["type 3", "LSA 3", "3", "type3", "lsa3", "summary LSA"],
    "S4": ["type 4", "LSA 4", "4", "type4", "lsa4", "ASBR summary LSA", "ASBR summary"],
    "S5": ["type 5", "LSA 5", "5", "type5", "lsa5", "external LSA"],
    "S12": ["{S1}", "{S2}"],
    "S34": ["{S4}", "{S3}"],
    "S3_4": ["{S3}", "{S4}"],
    "SV": [
      "send", "originate", "generate", "create", "advertise", "produce", "inject", "flood"
    ],
    "TA1": ["type 1", "LSA 1", "1"],
    "TA2": ["type 2", "LSA 2", "2"],
    "TA34": ["type 3", "LSA 3", "3", "type 4", "LSA 4", "4"],
    "TA5": ["type 5", "LSA 5", "5"],
    "W1": ["every router", "each router", "all routers"],
  },
  "Type 1 Router LSAs come from every router": ["{S1}~{EVERY_ROUTER}", "{W1} {SV} {TA1}"],
  "Type 2 Network LSAs come from the DR": ["{S2}~{DR}", "{DR} {SV} {TA2}"],
  "Types 1 and 2 stay in their own area": ["{S12}~{IN_AREA}"],
  "Types 3 and 4 come from the ABR": ["{S34}~{ABR}", "{ABR} {SV} {TA34}"],
  "Type 3 floods into other areas": ["{S3_4}~{BETWEEN}"],
  "Type 5 External LSAs come from the ASBR": ["{S5}~{ASBR}", "ASBR {SV} {TA5}"],
  "Type 5 floods to every area": ["{S5}~{EVERY_AREA}"],
  "Types 1 and 2 stay inside their own area": ["{S12}~{IN_AREA}"],
  "Type 3 carries networks into other areas": ["{S4}~", "{S3}~{BETWEEN}"],
  "Type 4 tells other areas where the ASBR is": ["{S4}~{ASBR_REACH}"],
  "Type 5 brings in routes from outside OSPF": ["{S5}~{OUTSIDE}"],
},
"q5d-v6": {
  _lists: {
    "OWNT": [
      "self-generated", "self generated", "self generates", "generates its own", "builds its own",
      "own address", "own", "itself", "builds", "build", "creates", "create", "generates", "generate",
      "makes", "make", "picks", "pick", "chooses", "choose", "selects", "self", "EUI-64", "EUI64",
      "random", "randomly", "autoconfigure", "autoconfigures", "autoconfigured"
    ],
    "SLT": [
      "from SLAAC", "by SLAAC", "via SLAAC", "SLAAC", "self-generated", "self generated",
      "SLAAC address", "SLAAC for the address", "SLAAC for address", "uses SLAAC", "use SLAAC",
      "is SLAAC", "is SLAAC with", "still SLAAC", "own", "itself", "builds", "creates", "generates",
      "makes", "picks", "chooses", "information", "other information", "other settings", "other config",
      "other configuration", "no record", "keeps no record"
    ],
    "AST": [
      "assign", "assigns", "assigned", "hands out", "gives out", "gives the address", "gives addresses",
      "gives it", "provides the address", "provides addresses", "provides it", "allocates", "allocate",
      "allocated", "lease", "leases", "leased", "issues", "offers the address", "from DHCPv6 server",
      "from the DHCPv6 server", "from DHCPv6", "from the server", "from a DHCPv6 server",
      "by the DHCPv6 server", "by the server", "DHCPv6 server"
    ],
    "DX3": ["DNS", "DNS server", "DNS information"],
    "DVF": [
      "from", "comes from", "is from", "provided by", "is provided by", "supplied by", "is supplied by",
      "given by", "is given by", "is"
    ],
    "DS": ["DHCP", "DHCPv6"],
    "SS": ["DHCP", "DHCPv6", "DHCP server", "DHCPv6 server"],
    "SSV": ["DHCP server", "DHCPv6 server"],
    "VS": ["provides", "gives", "supplies", "sends", "offers", "hands out"],
    "XS": [
      "DNS", "DNS server", "DNS information", "information like DNS", "information such as DNS",
      "info such as DNS", "information to the device such as DNS",
      "information to the devices such as DNS", "other information such as DNS"
    ],
    "GS": ["gateway", "default gateway"],
    "RS": [
      "RA", "RAs", "router advertisement", "router advertisements", "router s RA", "router s RAs",
      "router s router advertisement"
    ],
    "GV": [
      "from", "learned from", "is learned from", "comes from", "is from", "taken from", "is taken from",
      "obtained from", "is obtained from", "got from", "provided by", "is provided by", "supplied by",
      "is supplied by", "given by", "is given by", "set by", "is set by", "advertised by",
      "is advertised by", "advertised in", "sent in", "is sent in", "learned via", "is learned via",
      "learned through"
    ],
    "RW": [
      "for", "gives", "provides", "supplies", "sets", "advertises", "tells the host", "is used for"
    ],
    "GG": ["the gateway", "the default gateway", "gateway", "default gateway"],
    "MF": ["M flag", "M bit", "M", "managed flag"],
    "OF": ["O flag", "O bit", "O", "other flag"],
    "FVTM": [
      "means {BADM}", "1 means {BADM}", "is 1 means {BADM}", "set to 1 means {BADM}", "= 1 means {BADM}",
      "for {BADM}", "1 for {BADM}", "is for {BADM}", "1 is {BADM}", "set means {BADM}"
    ],
    "BADM": ["stateless", "SLAAC"],
    "FVTO": [
      "means {BADO}", "1 means {BADO}", "is 1 means {BADO}", "set to 1 means {BADO}", "= 1 means {BADO}",
      "for {BADO}", "1 for {BADO}", "is for {BADO}", "1 is {BADO}", "set means {BADO}"
    ],
    "BADO": ["stateful", "SLAAC"],
  },
  "SLAAC~builds its own address": ["SLAAC~{OWNT}", "@SLAAC~{OWNT}"],
  "stateless~has the device generate its own address": ["stateless~{SLT}", "@stateless~{SLT}"],
  "DHCP server assigns the address": ["stateful~{AST}", "@stateful~{AST}"],
  "DNS server from the DHCPv6 server": [
    "{DX3} {DVF} {DS}", "DNS and other information from DHCP", "DNS and other information from DHCPv6",
    "DNS DHCP", "DNS DHCPv6", "DNS server DHCP", "DNS server DHCPv6", "{SS} {VS} {XS}",
    "{SSV} which {VS} {XS}", "{SSV} that {VS} {XS}"
  ],
  "gateway from the RA": [
    "{GS} {GV} {RS}", "{RS} {RW} {GG}", "gateway RA", "gateway the RA", "gateway router advertisement",
    "gateway is the router s link local", "gateway is the link local", "gateway is link local",
    "gateway is fe80", "gateway link local", "gateway fe80",
    "default gateway is the router s link local", "default gateway is the link local",
    "default gateway is fe80"
  ],
  "M flag set to 1": [
    "M 1", "M flag 1", "M flag is 1", "M flag set", "M flag is set", "M flag is set to 1", "M bit 1",
    "M bit set", "M bit is set", "M flag on", "M flag means stateful", "M flag for stateful",
    "M flag is for stateful", "managed flag 1", "managed flag is 1", "managed flag set",
    "managed flag is set", "managed config flag set", "managed config flag 1",
    "managed config flag is set", "managed address flag set", "M 0 and O 0", "M and O 0",
    "M and O both 0", "both 0", "both flags 0", "both flags are 0", "{MF}~", "@!{MF}~{FVTM}", "{OF}~"
  ],
  "O flag set to 1": [
    "O 1", "O flag 1", "O flag is 1", "O flag set", "O flag is set", "O flag is set to 1", "O bit 1",
    "O bit set", "O bit is set", "O flag on", "O flag means stateless", "O flag for stateless",
    "O flag is for stateless", "other flag 1", "other flag set", "other flag is set",
    "other config flag set", "other config flag 1", "other config flag is set",
    "other configuration flag set", "0 and O 0", "O 0 and M 0", "M and O are 0", "both are 0",
    "both flags set to 0", "both off", "both flags off", "neither flag set", "{OF}~", "@!{OF}~{FVTO}",
    "{MF}~"
  ],
},
"q6-ts": {
  _lists: {
    "common.DEC": [
      "should be", "needs to be", "need to be", "must be", "has to be", "supposed to be", "not",
      "correctly", "correct", "properly"
    ],
    "common.R1": ["R1", "Router 1", "Router1"],
    "common.R2": ["R2", "Router 2", "Router2"],
    "common.G01": [
      "G0/1", "Gi0/1", "Gig0/1", "GigabitEthernet0/1", "GigabitEthernet 0/1", "LAN interface",
      "LAN-facing interface"
    ],
    "common.S001": [
      "S0/0/1", "Serial0/0/1", "Serial 0/0/1", "Se0/0/1", "serial interface", "serial link",
      "WAN interface", "outside interface", "ISP"
    ],
    "common.GI01": ["g0/1", "gi0/1", "gig0/1", "gigabitethernet0/1", "gigabitethernet 0/1"],
    "common.GI00": ["g0/0", "gi0/0", "gig0/0", "gigabitethernet0/0", "gigabitethernet 0/0"],
    "common.NOTRANS": [
      "aren't translated", "isn't translated", "never translated", "not being translated",
      "nothing is translated", "nothing gets translated", "no translation", "no translations",
      "untranslated", "not natted", "aren't natted", "doesn't translate", "does not translate",
      "doesn't get translated", "don't get translated", "not get translated", "are not translated",
      "is not translated", "not translated"
    ],
    "common.NOREPLY": [
      "can't reply", "cannot reply", "can't respond", "cannot respond", "has no route back",
      "no route back", "can't route back", "cannot route back", "no return route", "can't route private",
      "can't route to private", "cannot route private", "no route to the private", "no route to 192.168",
      "can't send replies", "cannot send replies", "replies never come back", "reply never comes back",
      "not routable", "non-routable", "unroutable", "can't return", "cannot return", "drops the replies",
      "doesn't know how to reply", "can't be replied to", "cannot be replied to", "can't be answered"
    ],
    "common.NF": [
      "don't forward", "doesn't forward", "do not forward", "does not forward", "never forwarded",
      "never forward", "never cross", "never crosses", "never pass", "never passes",
      "never get forwarded", "don't get forwarded", "doesn't get forwarded", "won't forward",
      "will not forward", "can't forward", "cannot forward", "can't cross", "cannot cross",
      "don't cross", "doesn't cross", "do not cross", "does not cross", "won't cross", "will not cross",
      "stop at the router", "stops at the router", "blocked by the router", "don't pass", "doesn't pass",
      "do not pass", "does not pass", "are not forwarded", "is not forwarded", "are not passed",
      "are not routed", "is not routed", "aren't forwarded", "isn't forwarded", "don't route",
      "doesn't route", "does not route", "do not route", "stays on the LAN", "stay on the LAN",
      "confined to the LAN", "limited to the LAN", "never leaves the LAN", "never leave the LAN"
    ],
    "common.adj": [
      "never become neighbours", "never become neighbors", "no adjacency", "adjacency never forms",
      "adjacency doesn't form", "adjacency can't form", "adjacency won't form", "adjacency isn't formed",
      "adjacency is not formed", "adjacency not formed", "adjacency fails", "never form an adjacency",
      "don't form an adjacency", "won't form an adjacency", "can't form an adjacency",
      "cannot form an adjacency", "prevents an adjacency", "prevent an adjacency",
      "prevents the adjacency", "prevents adjacency", "no neighbour relationship",
      "won't become neighbours", "don't become neighbours", "can't become neighbours",
      "cannot become neighbours", "never neighbours", "not neighbours", "aren't neighbours",
      "no neighbourship", "stop the neighbours forming", "stops the neighbours forming",
      "stop neighbours forming", "stops neighbours forming", "prevent neighbours forming",
      "prevents neighbours forming", "neighbours don't form", "neighbours won't form",
      "neighbours can't form", "neighbours never form", "neighbours do not form",
      "neighbours cannot form", "hellos are rejected", "hellos are ignored", "hellos rejected",
      "ignore the hellos", "ignore each other's hellos", "reject the hellos",
      "reject each other's hellos", "no routes are exchanged", "don't exchange routes",
      "no routes exchanged", "no routes"
    ],
    "relay.OBJ": [
      "helper", "helper address", "helper-address", "ip helper-address", "relay", "relay agent",
      "DHCP relay", "DHCP helper"
    ],
    "relay.no": [
      "no", "missing", "without", "lacks", "lacking", "is missing a", "is missing the", "has no",
      "doesn't have a", "does not have a", "hasn't got a", "has not got a", "needs a", "need a",
      "forgot the", "forgot a", "hasn't configured a", "has not configured a", "didn't configure a",
      "did not configure a"
    ],
    "relay.not-relaying": [
      "not relaying", "isn't relaying", "doesn't relay", "does not relay",
      "not configured with a helper", "isn't configured with a helper"
    ],
    "relay.helper": [
      "helper", "helper address", "helper-address", "ip helper-address", "relay", "relay address"
    ],
    "relay.on": ["on"],
    "relay.the-lan-interface": [
      "the LAN interface", "the LAN-facing interface", "its LAN interface", "the interface",
      "the client interface", "the clients interface"
    ],
    "relay.is-wrong": [
      "is wrong", "is incorrect", "is set wrong", "is configured wrong",
      "is pointing at the wrong server"
    ],
    "relay.wrong-helper": [
      "wrong helper", "wrong helper address", "wrong ip helper-address", "wrong relay",
      "wrong relay address", "wrong server", "wrong DHCP server", "wrong address", "incorrect helper",
      "incorrect helper address", "incorrect ip helper-address", "incorrect relay", "incorrect address",
      "incorrect server", "incorrect DHCP server", "helper address is wrong", "helper-address is wrong",
      "helper is wrong", "relay is wrong", "helper address is incorrect", "helper-address is incorrect",
      "helper is incorrect", "relay is incorrect", "helper address set wrong",
      "helper address is set wrong", "helper address is configured wrong",
      "is configured with the wrong", "is pointing at the wrong", "points to the wrong",
      "pointing to the wrong"
    ],
    "relay.addF": [
      "ip helper-address {srv}", "helper-address {srv}", "helper address {srv}",
      "helper address to {srv}", "helper address as {srv}", "helper address set to {srv}",
      "helper address of {srv}", "helper address should be {srv}", "helper to {srv}", "helper as {srv}",
      "relay to {srv}", "relays to {srv}", "points to {srv}", "point to {srv}", "point it to {srv}",
      "pointing to {srv}", "points at {srv}", "point it at {srv}"
    ],
    "relay.no-helper-address-wr": [
      "no helper-address {wr}", "no helper address {wr}", "remove {wr}", "delete {wr}",
      "remove the wrong helper", "delete the wrong helper", "remove the old helper",
      "remove the wrong one", "remove the wrong address", "remove the existing helper",
      "remove the incorrect helper", "replace {wr}", "change {wr}", "from {wr} to", "instead of {wr}",
      "rather than {wr}", "{wr} with", "{wr} to {srv}", "{wr} for {srv}", "{wr} by {srv}", "swap {wr}",
      "change the helper address to {srv}", "change the helper-address to {srv}",
      "change the helper to {srv}", "replace the helper address with {srv}",
      "replace the helper-address with {srv}"
    ],
    "natin.INS": [
      "inside", "nat inside", "ip nat inside", "an inside interface", "the inside interface",
      "an inside"
    ],
    "natin.OUTS": [
      "outside", "nat outside", "ip nat outside", "an outside interface", "the outside interface"
    ],
    "natin.is": ["is", "is wrongly", "is incorrectly", "is mistakenly", "has been", "was"],
    "natin.marked": ["marked", "set", "configured", "defined", "declared"],
    "natin.as": ["as", "to", ""],
    "natin.has-ip-nat-outside": [
      "has ip nat outside", "has nat outside", "is ip nat outside", "is nat outside",
      "is an outside interface", "wrongly outside", "wrongly marked outside",
      "outside instead of inside", "outside rather than inside", "outside instead of ip nat inside",
      "outside instead of nat inside", "outside but should", "outside when it should",
      "marked outside but", "marked as outside but", "marked outside when", "set as outside when",
      "set to outside when", "outside by mistake", "wrong side", "set the wrong way", "backwards",
      "swapped"
    ],
    "natin.should-be": [
      "should be", "needs to be", "must be", "should be marked", "needs to be marked",
      "should be set to", "needs to be set to", "should be marked as", "needs to be marked as",
      "should be configured as", "needs to be configured as", "needs"
    ],
    "natin.not-inside": ["not inside", "isn't inside", "not nat inside", "isn't nat inside"],
    "natin.not": ["not", "isn't"],
    "natin.marked.2": ["marked", "set", "configured", "defined", "designated"],
    "natin.as.2": ["as", "to", "for", ""],
    "natin.isn-t-configured-for-nat": [
      "isn't configured for nat", "not configured for nat", "no nat inside", "no ip nat inside",
      "no nat configured", "no nat", "unmarked", "missing ip nat inside", "missing nat inside",
      "missing inside", "lacks ip nat inside", "lacks nat inside", "without ip nat inside",
      "without nat inside", "doesn't have ip nat inside", "does not have ip nat inside",
      "doesn't have nat inside", "has no ip nat inside", "has no nat inside", "hasn't got ip nat inside",
      "has no inside", "not inside", "isn't inside", "not nat inside", "isn't nat inside",
      "not an inside interface", "isn't an inside interface", "not the inside interface",
      "isn't the inside interface"
    ],
    "natin.should-be.2": [
      "should be", "needs to be", "must be", "should be marked", "needs to be marked",
      "should be set to", "needs to be set to", "should be marked as", "needs to be marked as",
      "should be configured as", "needs to be configured as", "needs"
    ],
    "natin.hasn-t-been": [
      "hasn't been", "has not been", "was never", "never", "wasn't", "was not", "hasn't been",
      "haven't been"
    ],
    "natin.set": ["set", "marked", "configured", "defined", "designated"],
    "natin.as.3": ["as", "to", "for", ""],
    "natin.ip-nat-inside-is-missing": [
      "ip nat inside is missing", "nat inside is missing", "inside is missing", "ip nat inside missing",
      "nat inside missing", "is missing ip nat inside", "is missing nat inside",
      "ip nat inside is not configured", "ip nat inside isn't configured",
      "ip nat inside was never configured", "ip nat inside is not set", "ip nat inside isn't set"
    ],
    "natin.addF": [
      "no ip nat outside ip nat inside", "no nat outside ip nat inside", "set ip nat inside",
      "add ip nat inside", "configure ip nat inside", "apply ip nat inside", "enter ip nat inside",
      "type ip nat inside", "add nat inside", "set nat inside"
    ],
    "natin.ip-nat-inside": ["ip nat inside", "nat inside", "as inside", "to inside"],
    "natin.no-ip-nat-outside": ["no ip nat outside", "no nat outside"],
    "natin.no-ip-nat-outside.2": [
      "no ip nat outside", "no nat outside", "remove ip nat outside", "remove nat outside",
      "remove outside", "remove the outside", "remove the ip nat outside", "take off outside",
      "delete ip nat outside", "from outside to inside", "outside to inside"
    ],
    "natacl.ACL": [
      "ACL 1", "access-list 1", "access list 1", "ACL", "access-list", "access list", "acl1"
    ],
    "natacl.uses-a-subnet-mask": [
      "uses a subnet mask", "used a subnet mask", "using a subnet mask", "has a subnet mask",
      "is a subnet mask", "as a subnet mask", "subnet mask instead of a wildcard",
      "subnet mask rather than a wildcard", "subnet mask not a wildcard", "subnet mask where a wildcard",
      "mask instead of a wildcard", "mask rather than a wildcard", "mask not a wildcard",
      "mask where a wildcard", "netmask instead of a wildcard", "uses a netmask", "uses a mask",
      "used a mask", "has a mask", "isn't a wildcard", "is not a wildcard", "not a wildcard mask",
      "wildcard is wrong", "wildcard mask is wrong", "wrong wildcard", "incorrect wildcard",
      "wrong mask", "wildcard is backwards", "wildcard is inverted", "inverted wildcard",
      "should be a wildcard", "should use a wildcard", "needs a wildcard", "needs to be a wildcard",
      "has 255.255.255.0", "uses 255.255.255.0", "is 255.255.255.0", "with 255.255.255.0",
      "255.255.255.0 where a wildcard", "255.255.255.0 instead of", "255.255.255.0 rather than",
      "255.255.255.0 is a mask", "255.255.255.0 is a subnet mask", "needs a wildcard mask",
      "should use a wildcard mask", "uses 255.255.255.0 as the wildcard",
      "uses 255.255.255.0 as a wildcard", "has 255.255.255.0 as the wildcard",
      "has 255.255.255.0 as a wildcard", "wildcard is 255.255.255.0", "wildcard of 255.255.255.0",
      "wildcard 255.255.255.0", "wildcard mask 255.255.255.0"
    ],
    "natacl.only-matches-0": [
      "only matches .0", "ending in .0", "ends in .0", "end in .0", "only .0", "only the .0",
      "last octet must be 0", "last octet is 0", "last octet 0", "only addresses ending",
      "only matches the network address", "only the network address"
    ],
    "natacl.wrong-network": [
      "wrong network", "wrong subnet", "wrong address", "wrong range", "wrong LAN", "wrong IP range",
      "incorrect network", "incorrect subnet", "incorrect address", "different network",
      "different subnet", "another network", "another subnet", "doesn't match the LAN",
      "doesn't match the PCs", "doesn't include the PCs", "doesn't cover the PCs",
      "isn't the PCs' network", "isn't the LAN"
    ],
    "natacl.private-source-addresses": [
      "private source addresses", "private source address", "private addresses", "private address",
      "private IPs", "private IP", "private source"
    ],
    "natacl.access-list-1-permit-lan-0-0-0": [
      "access list 1 permit {lan} 0.0.0.255", "permit {lan} 0.0.0.255", "{lan} 0.0.0.255",
      "permit {lan} with 0.0.0.255"
    ],
    "natacl.should-permit-lan": [
      "should permit {lan}", "needs to permit {lan}", "must permit {lan}", "should match {lan}",
      "needs to match {lan}", "should include {lan}", "should be {lan}", "needs to be {lan}"
    ],
    "staticnet.wrong-static-route": [
      "wrong static route", "has the wrong static route", "has the wrong route",
      "incorrect static route", "has an incorrect static route", "static route is for the wrong network",
      "wrong network", "wrong destination", "wrong subnet", "wrong address", "wrong route",
      "wrong prefix", "incorrect network", "incorrect route", "incorrect destination",
      "incorrect subnet", "incorrect address", "typo", "mistyped", "typed wrong", "mistyped the network",
      "route to LAN-B is wrong", "route to LAN-B is incorrect", "route for LAN-B is wrong",
      "route is wrong", "route is incorrect", "static route is wrong", "static route is incorrect",
      "route has the wrong", "route is for the wrong"
    ],
    "staticnet.no-route": [
      "no route", "no route to LAN-B", "no route to {b}", "missing route", "missing a route",
      "doesn't have a route", "does not have a route", "has not got a route", "lacks a route", "no path",
      "can't reach LAN-B", "cannot reach LAN-B", "can't route", "cannot route",
      "doesn't know how to reach", "doesn't know how to get to", "does not know how to get to",
      "doesn't know the way to", "doesn't know a route to", "doesn't know about LAN-B",
      "doesn't know LAN-B", "has no way to reach", "has no way of reaching",
      "doesn't know where LAN-B is", "can't get to", "cannot get to", "not in the routing table",
      "isn't in the routing table", "no entry for LAN-B"
    ],
    "staticnet.drops-the-packets": [
      "drops the packets", "drops the traffic", "drops it", "drop them", "drop the packets",
      "dropped by R1", "discards them", "discards the packets", "discards it", "R1 drops", "R1 discards",
      "throws them away", "can't forward them", "cannot forward them", "doesn't forward them",
      "has nowhere to send"
    ],
    "staticnet.dropped-by-r1": [
      "dropped by R1", "R1 drops them", "R1 drops the packets", "R1 drops the traffic", "R1 drops it",
      "R1 discards them", "R1 discards the packets"
    ],
    "staticnet.ip-route-b": [
      "ip route {b}", "route {b} 255.255.255.0", "add a route to {b}", "add a route for {b}",
      "add a static route to {b}", "add a static route for {b}", "route to {b} 255.255.255.0",
      "route for {b} 255.255.255.0", "replace it with {b}", "change it to {b}", "should be {b}",
      "should be for {b}", "needs to be {b}", "correct it to {b}"
    ],
    "acldir.no-ip-access-group-n-out": ["no ip access-group {n} out", "no ip access-group {n} in", "no ip access-group"],
    "acldir.A": [
      "applied inbound", "applied in", "applied incoming", "is inbound", "set inbound",
      "configured inbound", "ACL inbound", "access-list inbound", "access list inbound",
      "has it inbound", "has the ACL inbound", "inbound instead of outbound",
      "inbound rather than outbound", "in instead of out", "in rather than out", "in the in direction",
      "in the inbound direction", "inbound direction", "wrong direction", "wrong way",
      "direction is wrong", "incorrect direction", "wrong way round", "the wrong way", "backwards",
      "ip access-group {n} in", "access-group {n} in", "in the wrong direction", "facing the wrong way"
    ],
    "acldir.fixO": [
      "apply it outbound", "apply outbound", "apply the ACL outbound", "apply it out",
      "move it to outbound", "change it to outbound", "change to outbound",
      "change it from inbound to outbound", "change inbound to outbound", "from in to out",
      "from inbound to outbound", "reapply it outbound", "re-apply it outbound",
      "apply it in the out direction", "should be outbound", "needs to be outbound", "must be outbound",
      "outbound instead of inbound", "outbound rather than inbound", "set it outbound",
      "put it outbound", "configure it outbound", "apply it as outbound", "apply it to outbound"
    ],
    "acldir.source-addresses": ["source addresses", "source", "sources", "sender", "source IP"],
    "acldir.only-sees-traffic-from-lan-b": [
      "only sees traffic from LAN-B", "only sees LAN-B", "sees traffic from LAN-B",
      "only traffic from LAN-B", "comes from LAN-B", "come from LAN-B", "never sees LAN-C",
      "never sees traffic from LAN-C", "doesn't see LAN-C", "does not see LAN-C", "never see LAN-C",
      "never matches", "never match", "deny never matches", "never hits", "LAN-C never reaches",
      "LAN-C is never seen", "LAN-C traffic never"
    ],
    "acldir.no-access-group-n-in": [
      "no access-group {n} in", "remove the inbound", "remove it from inbound", "remove it from in",
      "remove it inbound", "take it off inbound", "delete the inbound", "remove ip access-group {n} in",
      "remove access-group {n} in", "undo ip access-group {n} in"
    ],
    "acldir.in-ip-access-group-n-out": [
      "in ip access-group {n} out", "apply it outbound", "apply outbound", "apply the ACL outbound",
      "apply it out", "reapply it outbound", "re-apply it outbound", "apply it in the out direction",
      "change it to outbound", "change to outbound", "move it to outbound",
      "change it from inbound to outbound", "change inbound to outbound", "from inbound to outbound",
      "from in to out"
    ],
    "ospf.hello-interval": [
      "hello-interval", "hello interval", "hello timer", "hello timers", "hello",
      "ip ospf hello-interval"
    ],
    "ospf.dead-interval": ["dead interval", "dead timer", "dead-interval"],
    "ospf.wrong-hello": [
      "wrong hello", "incorrect hello", "wrong hello interval", "wrong hello timer",
      "incorrect hello interval", "incorrect hello timer", "wrong timers", "wrong timer",
      "incorrect timers", "hello interval doesn't match", "hello timer doesn't match",
      "hello interval is different", "hello timer is different", "hello interval is wrong",
      "hello timer is wrong", "hello interval is incorrect", "hello timer is incorrect",
      "timers are different", "timers don't match", "timers do not match", "timer mismatch",
      "hello mismatch", "hello interval mismatch", "hello timer mismatch", "non-default hello",
      "changed hello"
    ],
    "ospf.matching": [
      "matching", "must match", "have to match", "need to match", "needs to match", "don't match",
      "do not match", "doesn't match", "mismatch", "mismatched", "not the same", "aren't the same",
      "same on both"
    ],
    "ospf.no-ip-ospf-hello": [
      "no ip ospf hello", "no hello-interval", "no hello interval", "remove the hello-interval",
      "remove hello-interval", "remove the hello interval", "remove the hello timer", "remove the hello",
      "delete the hello-interval", "delete the hello", "ip ospf hello-interval 10",
      "s0/0/0 ip ospf hello-interval 10", "s0/0/0 no ip ospf hello-interval"
    ],
    "ospf.back-to-the-default": [
      "back to the default", "back to default", "default hello", "default timers", "back to 10",
      "reset the hello to 10", "reset the hello interval to 10", "reset the hello-interval to 10",
      "reset hello to 10", "reset it to 10", "reset to 10", "set it to 10", "set it back to 10",
      "set hello to 10", "set the hello to 10", "set hello interval 10", "set the hello interval to 10",
      "change it to 10", "change it back to 10", "change the hello to 10",
      "change the hello interval to 10", "change hello to 10", "hello-interval 10", "hello interval 10",
      "hello 10", "hello timer 10", "hello back to 10", "revert the hello", "revert to the default"
    ],
    "ospf.same-area": [
      "same area", "matching area", "matching areas", "areas must match", "area must match",
      "area has to match", "areas have to match", "area needs to match", "areas need to match",
      "not in the same area", "aren't in the same area", "area IDs must match", "area ID must match"
    ],
    "ospf.router-ospf-1-network-w-0-0-0-": ["router ospf 1 network {w} 0.0.0.3 area 0", "{w} 0.0.0.3 area 0"],
    "ospf.change-it-to-area-0": [
      "change it to area 0", "change to area 0", "change the area to 0", "change area to 0",
      "put it in area 0", "put the link in area 0", "move it to area 0", "move the link to area 0",
      "set it to area 0", "set the area to 0", "into area 0", "should be in area 0", "should be area 0",
      "needs to be in area 0", "needs to be area 0", "area 0 instead", "replace area {ar} with area 0",
      "change area {ar} to area 0", "area {ar} with area 0", "area {ar} to area 0",
      "from area {ar} to area 0", "area {ar} to 0", "network {w} 0.0.0.3 area 0",
      "network statement to area 0", "network to area 0", "change the network statement to area 0",
      "statement to area 0"
    ],
    "poolgw.GW": [
      "default gateway", "gateway", "default-router", "default router", "pool", "DHCP pool"
    ],
    "poolgw.fixT": [
      "default-router {gw}", "default router {gw}", "default-router to {gw}", "default router to {gw}",
      "gateway to {gw}", "gateway {gw}", "gateway of {gw}", "gateway as {gw}", "gateway should be {gw}",
      "should be {gw}", "change it to {gw}", "change to {gw}", "set it to {gw}", "set to {gw}",
      "replace {bad} with {gw}", "{bad} with {gw}", "{bad} to {gw}", "from {bad} to {gw}",
      "{bad} for {gw}", "{gw} instead of {bad}", "{gw} rather than {bad}", "point it to {gw}",
      "point to {gw}", "use {gw}", "set {gw}"
    ],
    "poolgw.wrong": [
      "wrong", "wrong address", "wrong gateway", "wrong default gateway", "incorrect",
      "incorrect address", "incorrect gateway", "incorrect default gateway", "is {bad}", "set to {bad}",
      "given as {bad}", "configured as {bad}", "configured to {bad}", "points to {bad}",
      "pointing to {bad}"
    ],
    "poolgw.should-be": [
      "should be", "needs to be", "must be", "change it to", "set it to", "change to", "correct is",
      "correct one is", "right one is"
    ],
    "poolgw.directly-to-each-other": [
      "directly to each other", "same subnet", "same LAN", "same network", "local traffic", "locally",
      "don't need the gateway", "doesn't need the gateway", "don't use the gateway",
      "doesn't use the gateway", "without the gateway", "no gateway needed", "isn't needed",
      "not needed", "doesn't go through the gateway", "don't go through the gateway"
    ],
    "poolgw.isn-t-on-lan-a": [
      "isn't on LAN-A", "not on LAN-A", "not on the LAN", "isn't on the LAN", "isn't on the subnet",
      "not on the subnet", "isn't in the subnet", "not on that subnet", "isn't on that subnet",
      "not in the subnet", "different subnet", "another subnet", "wrong subnet", "doesn't exist",
      "does not exist", "no device", "nothing at", "not a router", "isn't a router", "not R1",
      "isn't R1", "not the router", "isn't the router", "nonexistent", "non-existent", "no router",
      "nothing answers", "no one answers"
    ],
    "natacl.fixW": [
      "wildcard 0.0.0.255", "wildcard of 0.0.0.255", "wildcard mask 0.0.0.255",
      "wildcard mask of 0.0.0.255", "permit {lan} 0.0.0.255", "{lan} 0.0.0.255", "with 0.0.0.255",
      "use 0.0.0.255", "using 0.0.0.255", "to 0.0.0.255", "should be 0.0.0.255", "be 0.0.0.255",
      "needs 0.0.0.255", "need 0.0.0.255", "255.255.255.0 with 0.0.0.255", "255.255.255.0 to 0.0.0.255",
      "255.255.255.0 for 0.0.0.255", "255.255.255.0 by 0.0.0.255", "0.0.0.255 instead of 255.255.255.0",
      "0.0.0.255 rather than 255.255.255.0", "0.0.0.255 not 255.255.255.0"
    ],
  },
},
};
