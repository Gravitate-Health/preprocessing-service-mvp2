import { Response, Request } from "express";
import { Logger } from "../utils/Logger";
import { get } from "http";

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const getLeaflet = (epi: any) => {
  let leafletSectionList = epi['entry'][0]['resource']['section'][0]['section']
  return leafletSectionList
}

const getSnomedCodes = async () => {
  const snomedCodes = await fetch('https://raw.githubusercontent.com/HL7/UTG/master/ig.json').then((response) => {
    return response.json()
  }).then((data) => {
    return data['expansion']['contains']
  })
  return snomedCodes
}

function annotationProcess(divString: string, code: object) {
  let dom = new JSDOM(divString);
  let document = dom.window.document;
  let leaflet = document.querySelectorAll('div');
  recursiveTreeWalker(leaflet, code, document);

  return document.documentElement.outerHTML;
}

function recursiveTreeWalker(nodeList: any, code: any, document: any) {
  for (let node of nodeList) {
      if (node.childNodes.length > 0) {
          if (node.childNodes.length == 1) {
              if (node.childNodes[0].nodeName == '#text') {
                  if (node.childNodes[0].textContent.includes(code["en"])) {
                      const span = document.createElement('span');
                      span.className = code["ID"];
                      span.textContent = node.childNodes[0].textContent;
                      node.childNodes[0].textContent = '';
                      node.appendChild(span);
                  }
                  else {
                      recursiveTreeWalker(node.childNodes, code, document);
                  }
              } else {
                  recursiveTreeWalker(node.childNodes, code, document);
              }
          } else {
              recursiveTreeWalker(node.childNodes, code, document);
          }
      } else {
          if (node.textContent.includes(code["en"])) {
              const span = document.createElement('span');
              span.className = code["ID"];
              span.textContent = node.childNodes[0].textContent;
              node.childNodes[0].textContent = '';
              node.appendChild(span);
          }
      }
  }
}

const addSemmanticAnnotation = (leafletSectionList: any[], snomedCodes: any[]) => {
  let preprocessedSections: any = []
  leafletSectionList.forEach((section) => {
    const divString = section['text']['div']
    snomedCodes.forEach((code) => {
      if (divString.includes(code['en'])) {
        section['text']['div'] = annotationProcess(divString, code)
      }
    })
  })
  return preprocessedSections
}

export const preprocess = async (req: Request, res: Response) => {
  let epi = req.body;
  console.log(`Received ePI with Length: ${JSON.stringify(epi).length}`);
  Logger.logInfo('preprocessing.ts', 'preprocess', `queried /preprocess function with epi ID: ${JSON.stringify(epi['id'])}`)
  let leafletSectionList
  let snomedCodes
  try {
    snomedCodes = await getSnomedCodes()
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
