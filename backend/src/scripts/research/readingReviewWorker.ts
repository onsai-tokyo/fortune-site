import { ReadingReviewStore } from '../../research/readingReview.js'

const chunks:Buffer[]=[]
for await(const chunk of process.stdin)chunks.push(Buffer.from(chunk))
const {root,input}=JSON.parse(Buffer.concat(chunks).toString('utf8'))
const result=new ReadingReviewStore(root).create(input.birth,input.previousRunID)
process.stdout.write(JSON.stringify(result))
