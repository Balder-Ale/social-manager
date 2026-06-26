import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function main() {
  console.log('🏁 Starting Demo Flow pipeline simulation...');
  
  // 1. Fetch Tenant & Brand from Database (created by seed)
  const brand = await prisma.brand.findFirst();
  if (!brand) {
    console.error('❌ No brand found in database. Did you run the seed script? (pnpm run seed)');
    process.exit(1);
  }
  
  console.log(`ℹ️ Found Brand: "${brand.name}" (ID: ${brand.id}) with tone: "${brand.tone}"`);
  
  // 2. Call backend /api/analyze/trends to get trends & hooks
  console.log('🤖 Triggering trend and hook analysis...');
  let trends: string[] = [];
  let hooks: string[] = [];
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001';
    const response = await axios.post(`${backendUrl}/api/analyze/trends`, {
      brandId: brand.id,
      topic: 'AI in Social Media Marketing'
    });
    
    trends = response.data.trends || [];
    hooks = response.data.hooks || [];
    console.log(`✅ Analysis complete (Source: ${response.data.source})`);
  } catch (error: any) {
    console.warn('⚠️ Could not connect to backend server. Using local logic fallback.');
    trends = [
      'Micro-video series sharing insider secrets of AI in Social Media Marketing',
      'Dynamic visual carousels matching the friendly tone',
      'Behind-the-scenes authentic reels showing workflow'
    ];
    hooks = [
      'Stop posting manually! Here is how AI is changing the game...',
      'If you\'re not using AI for social media in 2026, you\'re falling behind.',
      'Want to master social automation? Here are 3 tips.'
    ];
  }
  
  console.log('📈 Generated Trends:', trends);
  console.log('🪝 Generated Hooks:', hooks);
  
  // 3. Select a hook and create a draft Post in the database
  const selectedHook = hooks[0] || 'Default Hook';
  console.log(`📝 Creating a new Post with selected hook: "${selectedHook}"`);
  
  const post = await prisma.post.create({
    data: {
      title: 'Demo AI-Generated Post',
      content: `${selectedHook}\n\nSocial Media is changing rapidly. Embracing AI tools allows creators to focus on creativity while automation handles scheduling, metrics, and posting logistics.`,
      status: 'draft',
      brandId: brand.id
    }
  });
  
  console.log(`✅ Post created in database with ID: ${post.id}`);
  
  // 4. Create and save a Workflow execution run
  console.log('🔄 Saving Workflow run execution details...');
  const workflow = await prisma.workflow.create({
    data: {
      postId: post.id,
      steps: {
        trendHookAnalysis: 'completed',
        copywriting: 'completed',
        qualityAssurance: 'passed'
      },
      result: {
        score: 95,
        remarks: 'Excellent alignment with brand tone and guidelines.',
        platforms: ['instagram', 'facebook']
      }
    }
  });
  
  console.log(`✅ Workflow run saved with ID: ${workflow.id}`);
  
  // 5. Final output
  console.log('\n🎉 Pipeline execution completed successfully!');
  console.log(JSON.stringify({
    success: true,
    brandName: brand.name,
    post: {
      id: post.id,
      title: post.title,
      content: post.content
    },
    workflow: {
      id: workflow.id,
      result: workflow.result
    }
  }, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Error executing demo flow:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
