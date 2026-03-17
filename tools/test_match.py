import json, re

raw="""Accenture|B6
ADHR Group Agenzia Per Il Lavoro|F24
Agrintesa|E23
Akkodis|A17
Akronos Technologies Group|G21
Alfasigma|E37
Allianz|G15
Allsides|C24
Alpitronic|A6
Alstom|B13
Altea Federation|G38
Alten Italia|A7
Areajob SpA|G3
auxiell group|A19
Ayes|A16
Bcube SpA|G13
BDO Italia|C19
Beckhoff Automation srl|B32
Benu Farmacia|A29
Berco|B23
Berluti|E18
Bios Management|A14
BolognaFiere Group|E31
Bonfiglioli SpA|C32
Bper Banca SpA|G17
Bureau Veritas Italia|C21
Bv tech group|G41
Camplus|G20
Cantiere del pardo|B12
Carraro|A31
Cattaneo Zanetto Pomposo & co|B1
Cefla|D13
Centro di Sperimentazione Laimburg|F36
Centro Software SpA|G32
CFT SpA|G8
Chiesi Farmaceutici|F30
Chiron Energy|A24
Cimbria|C26
Cineca|F26
Clementoni|C37
Cocchi Technologies|C36
Coesia SpA|C11-C13
Comecer SpA|G14
Conserve Italia soc. coop. agricola|F23
Coop Alleanza 3.0|C17
Coopservice|G24
Coswell SpA|E38
Credem Credito italiano|G43
Credit Agricole Italia|F25
Crif SpA|C23
Datalogic|E10
Davines Group|E20
Decathlon|E29
Deloitte|C5
d-fine|A12
Dometic|E25
Ducati|C30
Eco Certificazioni spa|G5
Edison|B31
Eli Lilly|C6
Engie|A13
Epsol srl|A26
EssilorLuxottica|C12-14
Essity Italy|A42
Eurotec srl|A44
EY|F8
F.B. SpA|D40
Fileni|E17
Focaccia Group|E11-E13
FOR SpA|B37
Fortna|B36
Forvis Mazars|A28
Futur-A Group|D11
Ghibson Italia srl - Bonomi Group|A35
Gi Group|C39
Grant Thornton SpA|A32
Grundfos Water Treatment|A5
Gruppo Amadori|F17
Gruppo BCC Iccrea|C25
Gruppo Colorobbia|G11
Gruppo Concorde SpA|F10
Gruppo Ferrovie dello Stato Italiane|F5
Gruppo Fini SpA|E26
Gruppo GranTerre|E28
Gruppo Hera|D12-D14
Gruppo Teddy|F19
Gruppo Zucchetti|B11
Hitachi Energy|F20
Horsa|C7
HPE Group|C27
iconsulting|G31
Ikos Consulting Italia|A37
Illumina|B8
Ima SpA|C8
Ing. Ferrari SpA|B35
Inres sc|B29
Italian Exhibition Group SpA|B30
KPMG|G30
Lafarmacia.|B14
Lavoropiù SpA|F18
Lidl Italia|F11-F13
LivaNova|B18
Ludovico Martelli SpA|F31
Maire SpA|A46
Mapei SpA|E9
Marazzi Group|G9
Marchesini Group|D6-D8
Marposs SpA|E8
Marr SpA|F29
MEC3 - Gruppo Casa Optima|F7
Moltiply Group Spa|F32
Motor Power Company|D37
Nexia Audirevi|B3
Novomatic Italia SpA|F12
NX Engineering|F14
Officine Maccaferri SpA|B24
Openjobmetis SpA|B38
OT Consulting|A10
Philip Morris International|A11
Pirola Pennuto Zei & Associati|A2
Profilglass SpA|A8
PwC|G7
randstad|B25
Raytec Vision|G6
Rekeep|E15
Relatech SpA|F37
Reply|A30
Rete Servizi Agricoltura|E22
Riccoboni Holding SpA|G23
Risorse|G26
Robopac|E12-E14
Rothoblaas|E36
Sacmi Imola sc|D7
Saint-Gobain Italia|B17
SCM Group SpA|G27
Segula Technologies|F38
Sherwin-Williams|B20
Solux srl|A22
Stanzani SpA|G25
Stef|A1
System Logistics SpA|G35
Talenti Emilia-Romagna / International Talents Emilia-Romagna|F3-F4
Tampieri Group|G12
TAS SpA|A38
Teach For Italy|E35
Techint Engineering & Construction|D39
Tennant Company|G45
Tetra Pak|A23
Timac Agro Italia|F35
TMC Italia SpA|A25
Toyota Material Handling|B5-B7
Trenitalia Tper|B19
Trevi Group|D38
Truzzi SpA|B26
Tyche Bank|G18
Umana|C18-C20
Unicoop Firenze|G39
Unicredit|G29
Unigrà|E24
Unitec|D5
Var Group|A40
Vinavil SpA|E7
Vislab - Ambarella|G37
wienerberger|G36
XTEL|C38"""

def nm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())

sm = {}
for l in raw.strip().split('\n'):
    p = l.split('|')
    sm[nm(p[0])] = p[1]

with open('aziende_dettagli.json') as f:
    data = json.load(f)

miss = []
for a in data:
    nj = nm(a['Nome'])
    ok = nj in sm
    if not ok:
        for k in sm:
            if k in nj or nj in k:
                ok = True
                break
    if not ok:
        for k in sm:
            pl = 0
            for i in range(min(len(nj), len(k))):
                if nj[i] == k[i]:
                    pl += 1
                else:
                    break
            if pl >= 5:
                ok = True
                break
    if not ok:
        miss.append(a['Nome'])

print(f'{len(data)-len(miss)}/{len(data)} matched')
for m in miss:
    print(f'MISS: {m}')
