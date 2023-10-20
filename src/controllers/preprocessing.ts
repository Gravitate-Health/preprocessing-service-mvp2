import { Response, Request } from "express";
import { Logger } from "../utils/Logger";
import axios, { all } from 'axios';

let leafletLanguage: string
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const snomedEndpointList = [
    'pregnancy',
    'diabetes',
    'medication-interaction',
    'vih',
    'allergies',
    'simplification'
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
    let leaflet = document.querySelectorAll('div');
    recursiveTreeWalker(leaflet, code, document);
    let response = document.documentElement.outerHTML;
    if (document.getElementsByTagName("html").length > 0) {
        response = document.getElementsByTagName("html")[0].innerHTML;
        console.log("Response: " + response);
    }
    if (document.getElementsByTagName("head").length > 0) {
        document.getElementsByTagName("head")[0].remove();
    }
    if (document.getElementsByTagName("body").length > 0) {
        response = document.getElementsByTagName("body")[0].innerHTML;
        console.log("Response: " + response);
    } else {
        console.log("Response: " + document.documentElement.innerHTML);
        response = document.documentElement.innerHTML;
    }
    return response;
}

function recursiveTreeWalker(nodeList: any, code: any, document: any) {
    for (let node of nodeList) {
        if (node.childNodes.length == 1 && node.childNodes[0].nodeName == '#text') {
            if (node.childNodes[0].textContent.includes(code[leafletLanguage])) {
                const span = document.createElement('span');
                span.className = code["ID"];
                span.textContent = node.childNodes[0].textContent;
                node.childNodes[0].textContent = '';
                node.appendChild(span);
            } else {
                recursiveTreeWalker(node.childNodes, code, document);
            }
        } else {
            recursiveTreeWalker(node.childNodes, code, document);
        }
        if (node.textContent.includes(code[leafletLanguage])) {
            const span = document.createElement('span');
            span.className = code["ID"];
            span.textContent = node.childNodes[0].textContent;
            node.childNodes[0].textContent = '';
            node.appendChild(span);
        }
    }
}

const addSemmanticAnnotation = (leafletSectionList: any[], snomedCodes: any[]) => {
    leafletSectionList.forEach((section) => {
        const divString = section['text']['div']
        snomedCodes.forEach((code) => {
            if (divString.includes(code[leafletLanguage])) {
                section['text']['div'] = annotationProcess(divString, code)
            }
        })
    })
    return leafletSectionList
}

export const preprocess = async (req: Request, res: Response) => {
    let epi = req.body;
    console.log(`Received ePI with Length: ${JSON.stringify(epi).length}`);
    Logger.logInfo('preprocessing.ts', 'preprocess', `queried /preprocess function with epi ID: ${JSON.stringify(epi['id'])}`)
    switch(epi['entry'][0]['resource']['language'].toLowerCase()) {
        case 'en':
            leafletLanguage = 'en'
            break
        case 'es':
            leafletLanguage = 'es'
            break
        default:
            leafletLanguage = 'en'
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
    epi['entry'][0]['resource']['section'][0]['section'] = annotatedSectionList
    epi["entry"][0]["resource"]["category"][0]["coding"][0] = {
        "system": epi["entry"][0]["resource"]["category"][0]["coding"][0]["system"],
        "code": "P",
        "display": "Preprocessed"
    }
    console.log(`Returning ePI with Length: ${JSON.stringify(epi).length}`);
    res.status(200).send(epi);
    return
};
