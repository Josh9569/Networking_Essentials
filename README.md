# Networking Fundamentals

I made this for myself to practice for my own exams, so I figured this might be useful for anyone else studying their CCNA or networking-related course so I made it a live page. If there are any issues or feature requests feel free to do a PR, start an issue or whatever I should see it.

Live page: [Networking Essentials](https://josh9569.github.io/Networking_Essentials/index.html)

**Games included to practice:**
*   **Subnet:** This is the core focus where you practice calculating subnet masks, network boundaries, and host availability using CIDR notation for efficient IP address allocation.
*   **Binary:** Understanding binary is fundamental because all IP addressing and subnet calculations are fundamentally based on manipulating bit positions (masking) to determine network versus host bits.
*   **OSI / TCP-IP Model:** This provides the structural context for networking by defining layers; subnetting specifically operates within Layer 3 (the Network Layer). Practice matching protocols and technologies to their correct OSI layer or TCP/IP layer, and identify protocols from plain-English descriptions. Includes a searchable reference covering all major protocols.
*   **VLSM (Variable Length Subnet Mask):** This is an advanced technique used to efficiently allocate IP address space by allowing networks to have different, customized subnet sizes rather than using fixed-size blocks.
*   **IPv6:** Covers the basics of IPv6 addressing including expanding compressed addresses to their full 128-bit form, compressing full addresses using RFC 5952 rules, and identifying address types such as global unicast, link-local, multicast, loopback, unique local, and unspecified.
*   **Hex:** Practice converting between hexadecimal, decimal, and binary across nibbles, bytes, and 16-bit words — essential for reading MAC addresses, IPv6, and packet captures.
*   **Switching Lab:** An interactive Layer 2 lab where you cable switches and PCs together on a canvas and configure VLANs, trunk links, and EtherChannel using either a simple port table or an IOS-style CLI, plus STP challenges where you identify the root bridge and blocking port.
*   **Routing Table Trainer:** Practice reading and choosing routing table entries — pick the longest prefix match for a destination IP, resolve administrative-distance ties between routing sources, convert IPs to binary to find the best match by hand, read and parse a `show ip route`-style line, and build a network's details (or the CIDR entry itself) from a routing table entry.