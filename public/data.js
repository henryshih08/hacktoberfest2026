export const source = 'https://science.nasa.gov/earth/earth-observatory/25-years-of-growth-in-las-vegas-37228/';
export const changes = [
 {id:'northwest',number:'01',title:'The city moves northwest',category:'Urban expansion',color:'#e3a45b',bounds:[21,16,22,23],before:'A broad desert margin with sparse roads and isolated development.',after:'A much denser street grid extends toward the surrounding mountains.',description:'The northwest edge shows a broad expansion of the visible urban footprint between the two images.',limitation:'The highlighted boundary is illustrative. We have not measured its area or ranked it against every other change.'},
 {id:'southwest',number:'02',title:'A new southwestern corridor',category:'Roads & development',color:'#8fc8b6',bounds:[22,49,21,23],before:'Mostly open desert west of the existing urban grid.',after:'Connected development and a prominent curving road corridor are visible.',description:'Development fills much of the southwest. NASA identifies Interstate 215 as part of the expansion visible in the later images.',limitation:'The imagery does not establish traffic volumes, construction dates, or individual building uses.'},
 {id:'south',number:'03',title:'Development extends south',category:'Urban expansion',color:'#adc2e6',bounds:[43,60,22,16],before:'Large stretches of open land south of the established city.',after:'More extensive blocks, roads, and developed surfaces.',description:'The southern urban edge extends into previously open land. Compare the visible street patterns on both sides of the slider.',limitation:'Color alone cannot establish vegetation loss: these acquisitions are from different seasons.'}
];
export function answerQuestion(question, selectedId) {
 const q=question.toLowerCase();
 let region=changes.find(c=>c.id===selectedId);
 const result=(text,regionId=null)=>({text,regionId,source,mode:'Reviewed evidence'});
 if(/why|cause|reason|who built|developer|permit/.test(q)) return result('These images show where the landscape changed, but cannot establish why construction happened or who commissioned it. Planning records and permits would be needed to answer that.',region?.id);
 if(/largest|most|biggest|how much|area|hectare|acre|percent/.test(q)) return result('The northwest is a clear example of extensive growth, so I have highlighted it. The demo does not measure changed area; it cannot establish which region grew the most.', 'northwest');
 if(/green|vegetation|tree|grass|park/.test(q)) return result('Do not interpret weaker green colors as confirmed vegetation loss. The 1984 image was captured in October and the 2009 image in January. Seasonal conditions can change vegetation color. No vegetation-loss measurement is included.');
 if(/source|date|satellite|resolution/.test(q)) return result('These are NASA Earth Observatory images based on USGS Landsat 5 data, acquired October 22, 1984 and January 12, 2009. The sensor resolution is approximately 30 meters. The annotations are manually reviewed demo observations, not automated detections.');
 if(/road|highway|southwest|corridor/.test(q)) region=changes[1];
 else if(/north|desert/.test(q)) region=changes[0];
 else if(/south/.test(q)) region=changes[2];
 if(region && /change|here|selected|explain|show|road|north|south|built|develop/.test(q)) return result(`${region.description} Before: ${region.before} After: ${region.after} ${region.limitation}`,region.id);
 if(/summary|overview|changed|development|growth/.test(q)) return result('The comparison shows the urban footprint expanding northwest and south, with a new southwestern road and development corridor. Select one of the three annotated regions to inspect the evidence. These observations do not quantify land-cover change.');
 return result('I can explain the three reviewed changes, their imagery sources, and the limits of this comparison. Try “What changed in the southwest?” or select a region and ask “What changed here?”');
}
