import { Response, Request } from "express";
import { Logger } from "../utils/Logger";

const getLeaflet = (epi: any) => {
  let leafletSectionList = epi['entry'][0]['resource']['section'][0]['section']
  return leafletSectionList
}

const addSemmanticAnnotation = (leafletSectionList: any[]) => {
  let preprocessedSections: any = []
  leafletSectionList.forEach(section => {
    //Preprocessing goes in here
    // ADD TEST PREPROCESS
    console.log("Adding <samplePreprocessTag> tag");
    section['text']['div'] = `<samplePreprocessTag><samplePreprocessTag3>${section['text']['div']}</samplePreprocessTag></samplePreprocessTag3>`




    preprocessedSections.push(section)
  })
  return preprocessedSections
}

export const preprocess = async (req: Request, res: Response) => {
  let epi = req.body;
  console.log(`Received ePI with Length: ${JSON.stringify(epi).length}`);
  Logger.logInfo('preprocessing.ts', 'preprocess', `queried /preprocess function with epi ID: ${JSON.stringify(epi['id'])}`)
  let leafletSectionList
  try {
    leafletSectionList = getLeaflet(epi)
  } catch (error) {
    res.status(400).send('Bad Payload')
    return
  }
  let annotatedSectionList
  try {
    annotatedSectionList = addSemmanticAnnotation(leafletSectionList)
  } catch (error) {
    res.status(500).send('Preprocessor error')
    return
  }
  epi['entry'][0]['resource']['section'][0]['section'] = annotatedSectionList
  console.log(`Returning ePI with Length: ${JSON.stringify(epi).length}`);
  res.status(200).send(epi);
  return
};
