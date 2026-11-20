"""Convertit un binaire brut en fichier .uf2 pour le RP2040.

Usage : python bin2uf2.py entree.bin sortie.uf2 0x10000000 [famille]
(famille : 0xe48bff56 pour le RP2040 par défaut, 0xe48bff59 pour le RP2350)

Le format UF2 découpe les données en blocs de 512 octets qui contiennent
chacun 256 octets utiles et leur adresse de destination. Le bootloader du
RP2040 écrit chaque bloc à son adresse : c'est ce qui permet au site de
produire un .uf2 qui ne touche que la zone des morceaux.
"""
import struct
import sys

UF2_MAGIC_START0 = 0x0A324655
UF2_MAGIC_START1 = 0x9E5D5157
UF2_MAGIC_END = 0x0AB16F30
UF2_FLAG_FAMILY_ID = 0x00002000
RP2040_FAMILY_ID = 0xE48BFF56
RP2350_ARM_S_FAMILY_ID = 0xE48BFF59
PAYLOAD = 256

def bin_to_uf2(data: bytes, base_address: int, family: int = RP2040_FAMILY_ID) -> bytes:
    if len(data) % PAYLOAD:
        data += b"\x00" * (PAYLOAD - len(data) % PAYLOAD)
    total = len(data) // PAYLOAD
    out = bytearray()
    for i in range(total):
        chunk = data[i * PAYLOAD:(i + 1) * PAYLOAD]
        header = struct.pack(
            "<8I",
            UF2_MAGIC_START0, UF2_MAGIC_START1, UF2_FLAG_FAMILY_ID,
            base_address + i * PAYLOAD, PAYLOAD, i, total, family,
        )
        block = header + chunk + b"\x00" * (476 - PAYLOAD) + struct.pack("<I", UF2_MAGIC_END)
        assert len(block) == 512
        out += block
    return bytes(out)

def main() -> None:
    if len(sys.argv) not in (4, 5):
        sys.exit(__doc__)
    with open(sys.argv[1], "rb") as f:
        data = f.read()
    family = int(sys.argv[4], 0) if len(sys.argv) == 5 else RP2040_FAMILY_ID
    uf2 = bin_to_uf2(data, int(sys.argv[3], 0), family)
    with open(sys.argv[2], "wb") as f:
        f.write(uf2)
    print(f"{sys.argv[2]} : {len(uf2) // 512} blocs ({len(data)} octets)")

if __name__ == "__main__":
    main()
