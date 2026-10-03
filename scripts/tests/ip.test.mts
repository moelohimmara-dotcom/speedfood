import { regrouperIpv6 } from "../../src/lib/securite/ip";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("ipv4 inchangee", regrouperIpv6("41.77.12.9"), "41.77.12.9");
verifier("inconnue inchangee", regrouperIpv6("inconnue"), "inconnue");
verifier(
  "ipv6 complete",
  regrouperIpv6("2001:0db8:85a3:0042:1000:8a2e:0370:7334"),
  "2001:0db8:85a3:0042::/64"
);
verifier(
  "deux adresses du meme /64 donnent la meme cle",
  regrouperIpv6("2001:db8:85a3:42::1"),
  regrouperIpv6("2001:db8:85a3:42:ffff:ffff:ffff:ffff")
);
verifier(
  "deux /64 differents donnent deux cles",
  regrouperIpv6("2001:db8:85a3:42::1") === regrouperIpv6("2001:db8:85a3:43::1"),
  false
);
verifier("abreviation en tete", regrouperIpv6("::1"), "0000:0000:0000:0000::/64");
verifier("majuscules normalisees", regrouperIpv6("2001:DB8:0:0::5"), "2001:0db8:0000:0000::/64");
verifier("zone ignoree", regrouperIpv6("fe80::1%eth0"), "fe80:0000:0000:0000::/64");
verifier("invalide inchangee", regrouperIpv6("zz::1"), "zz::1");
verifier("trop de groupes inchangee", regrouperIpv6("1:2:3:4:5:6:7:8:9"), "1:2:3:4:5:6:7:8:9");

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko === 0 ? 0 : 1);
