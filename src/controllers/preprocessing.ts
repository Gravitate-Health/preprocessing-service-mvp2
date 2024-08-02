import e, { Response, Request } from "express";
import { Logger } from "../utils/Logger";
import axios, { all } from 'axios';

let descriptionLang: string
let codesFound: {
    system: string, 
    ID: string,
    display: string 
}[] = []
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const snomedEndpointList = [
    'pregnancy',
    // 'diabetes',
    // 'medication-interaction',
    // 'vih',
    // 'allergies',
    // 'simplification'
]

const getLeaflet = (epi: any) => {
    let leafletSectionList = epi['entry'][0]['resource']['section'][0]['section']
    return leafletSectionList
}

const getSnomedCodes = async (terminologyType: string) => {
    const snomedCodes = await axios.get(`http://gravitate-health.lst.tfo.upm.es/terminologies/snomed/${terminologyType}/all`)
        .then((response) => {
            return response.data
        })
        .catch((error) => {
            console.log(error)
        })
    return snomedCodes
}

function annotationProcess(divString: string, code: object) {
    let dom = new JSDOM(divString);
    let document = dom.window.document;
    console.log("Divstring rendered: ", document.documentElement.outerHTML)
    let leaflet = document.querySelectorAll('div');
    recursiveTreeWalker(leaflet, code, document);
    let response = document.documentElement.outerHTML;
    if (document.getElementsByTagName("html").length > 0) {
        response = document.getElementsByTagName("html")[0].innerHTML;
    }
    if (document.getElementsByTagName("head").length > 0) {
        document.getElementsByTagName("head")[0].remove();
    }
    if (document.getElementsByTagName("body").length > 0) {
        response = document.getElementsByTagName("body")[0].innerHTML;
    } else {
        console.log("Response: " + document.documentElement.innerHTML);
        response = document.documentElement.innerHTML;
    }
    console.log("Response: ", response)
    return response;
}

function recursiveTreeWalker(nodeList: any, code: any, document: any) {
    for (let i = 0; i < nodeList.length; i++) {
        if (nodeList.item(i).childNodes.length == 1 && nodeList.item(i).childNodes[0].nodeName == '#text') {
            const nodeLC = nodeList.item(i).childNodes[0].textContent.toLowerCase()
            console.log("Node in lowercase: ", nodeLC)
            console.log("Code in lowercase: ", code[descriptionLang].toLowerCase())
            console.log("Does this node contain the code? ", nodeLC.includes(code[descriptionLang].toLowerCase()))
            if (nodeList.item(i).childNodes[0].textContent.toLowerCase().includes(code[descriptionLang].toLowerCase())) {
                const span = document.createElement('span');
                span.className = code["code"];
                if (nodeList.item(i).className  != "" && nodeList.item(i).className != null && nodeList.item(i).className != undefined) {
                    span.className = nodeList.item(i).className + " " + code["code"];
                }
                span.textContent = nodeList.item(i).childNodes[0].textContent;
                nodeList.item(i).childNodes[0].textContent = '';
                nodeList.item(i).appendChild(span);
            } else {
                recursiveTreeWalker(nodeList.item(i).childNodes, code, document);
            }
        } else {
            recursiveTreeWalker(nodeList.item(i).childNodes, code, document);
        }
    }
}

const addSemmanticAnnotation = (leafletSectionList: any[], snomedCodes: any[]) => {
    leafletSectionList.forEach((section) => {
        snomedCodes.forEach((code) => {
            const divString: string = section['text']['div']
            const divStringLC = divString.toLowerCase();
            console.log("Now using this divstring: ", divString)
            console.log("Now using this divstring in lowercase: ", divStringLC)
            console.log("Description: ", code[descriptionLang]);
            console.log("Does this code match the divstring? ", divStringLC.includes(code[descriptionLang].toLowerCase()))
            if (divStringLC.includes(code[descriptionLang].toLowerCase())) {
                let codeObject = {
                    "ID": code["code"],
                    "display": code[descriptionLang],
                    "system": code["codesystem"]
                }
                codesFound.push(codeObject)
                section['text']['div'] = annotationProcess(divString, code)
            }
        })
    })
    return leafletSectionList
}

const codeToExtension = (code: { ID: string, display: string, system: string }) => {
    return [
        {
            "url": "elementClass",
            "valueString": code.display
        },
        {
            "url": "concept",
            "valueCodeableReference": {
                "concept": {
                    "coding": [
                        {
                            "system": code.system,
                            "code": code.ID,
                            "display": code.display
                        }
                    ]
                }
            }
        }
    ]
}

export const preprocess = async (req: Request, res: Response) => {
    let epi = req.body;
    console.log(`Received ePI with Length: ${JSON.stringify(epi).length}`);
    Logger.logInfo('preprocessing.ts', 'preprocess', `queried /preprocess function with epi ID: ${JSON.stringify(epi['id'])}`)
    console.log("Language: ", epi['entry'][0]['resource']['language'].toLowerCase())
    switch(epi['entry'][0]['resource']['language'].toLowerCase()) {
        case 'en':
            descriptionLang = 'descr_en'
            break
        case 'es':
            descriptionLang = 'descr_es'
            break
        default:
            res.status(304).send(epi)
            return
    }
    let leafletSectionList
    let snomedCodes: any[] = []
    try {
        for (let terminologyType of snomedEndpointList) {
            const terminologyList = await getSnomedCodes(terminologyType)
            snomedCodes = snomedCodes.concat(terminologyList)
        }
    } catch (error) {
        res.status(500).send('Failed getting Snomed Codes')
        return
    }
    try {
        leafletSectionList = getLeaflet(epi)
    } catch (error) {
        res.status(400).send('Bad Payload')
        return
    }
    let annotatedSectionList
    try {
        annotatedSectionList = addSemmanticAnnotation(leafletSectionList, snomedCodes)
    } catch (error) {
        res.status(500).send('Preprocessor error')
        return
    }
    epi['entry'][0]['resource']['extension'] = [];
    for (let code of codesFound) {
        let codeSystemUrl;
        switch (code.system) {
            case "snomed":
                codeSystemUrl = "http://snomed.info/sct"
                break
            case "icpc-2":
                codeSystemUrl = "placeholder"
                break
            case "gravitate":
                codeSystemUrl = "https://www.gravitatehealth.eu/"
                break
            default:
                codeSystemUrl = "placeholder"
                break
        }
        const codeList: [] = epi['entry'][0]['resource']['extension']
        if (!codeList.some((e: any) => { 
            if (e['valueCodeableConcept'] == undefined) {
                return false
            } else {
                return e['valueCodeableConcept']['concept']['coding'][0]['code'] == code.ID && e['valueCodeableConcept']['concept']['coding'][0]['display'] == code.display
            }
        })) {
            epi['entry'][0]['resource']['extension'].push(codeToExtension({ID: code.ID, display: code.display, system: codeSystemUrl }));
        }
    }
    epi['entry'][0]['resource']['section'][0]['section'] = annotatedSectionList;
    if (epi["entry"][0]["resource"]["category"][0]["coding"][0]["code"] == "R") {
        epi["entry"][0]["resource"]["category"][0]["coding"][0] = {
            "system": epi["entry"][0]["resource"]["category"][0]["coding"][0]["system"],
            "code": "P",
            "display": "Preprocessed"
        };
    }
    console.log(`Returning ePI with Length: ${JSON.stringify(epi).length}`);
    res.status(200).send(epi);
    return
};
