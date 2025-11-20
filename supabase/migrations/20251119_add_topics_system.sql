-- =============================================
-- GLOBAL TOPICS / HASHTAG SYSTEM
-- Creates platform-wide topics, post assignments, and user preferences
-- =============================================

-- Enum for topic preferences
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'topic_preference') THEN
    CREATE TYPE topic_preference AS ENUM ('follow', 'mute');
  END IF;
END
$$;

-- =============================================
-- TOPICS TABLE
-- Global catalog of hashtags/topics managed by admins
-- =============================================
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active topics (needed for discovery/feed UI)
CREATE POLICY "Anyone can view active topics"
  ON public.topics
  FOR SELECT
  USING (is_active = true);

-- Allow admins to view inactive topics as well
CREATE POLICY "Admins can view all topics"
  ON public.topics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Allow admins to manage topics
CREATE POLICY "Admins can manage topics"
  ON public.topics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS set_topics_updated_at ON public.topics;
CREATE TRIGGER set_topics_updated_at
  BEFORE UPDATE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_topics_active ON public.topics(is_active);
CREATE INDEX IF NOT EXISTS idx_topics_featured ON public.topics(is_featured) WHERE is_featured = true;

-- =============================================
-- POST TOPIC ASSIGNMENTS
-- Junction table connecting posts to topics
-- =============================================
CREATE TABLE IF NOT EXISTS public.post_topics (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  applied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (post_id, topic_id)
);

ALTER TABLE public.post_topics ENABLE ROW LEVEL SECURITY;

-- Anyone can read topics attached to posts in active communities
CREATE POLICY "Anyone can view post topics in active communities"
  ON public.post_topics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      INNER JOIN public.communities c ON c.id = p.community_id
      WHERE p.id = post_topics.post_id
        AND c.is_active = true
    )
  );

-- Post authors or admins can manage topic assignments
CREATE POLICY "Post authors or admins can manage post topics"
  ON public.post_topics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_topics.post_id
        AND p.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_topics.post_id
        AND p.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_post_topics_topic_id ON public.post_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_post_topics_post_id ON public.post_topics(post_id);

-- =============================================
-- USER TOPIC PREFERENCES
-- Explicit follow/mute signals per user/topic
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_topic_preferences (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  preference topic_preference NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE public.user_topic_preferences ENABLE ROW LEVEL SECURITY;

-- Users can see their own preferences (admins see all)
CREATE POLICY "Users can view their topic preferences"
  ON public.user_topic_preferences
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Users can manage their own preferences
CREATE POLICY "Users can manage their topic preferences"
  ON public.user_topic_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can manage preferences for moderation/debugging
CREATE POLICY "Admins can manage topic preferences"
  ON public.user_topic_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS set_user_topic_preferences_updated_at ON public.user_topic_preferences;
CREATE TRIGGER set_user_topic_preferences_updated_at
  BEFORE UPDATE ON public.user_topic_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_topic_preferences_topic_id ON public.user_topic_preferences(topic_id);
CREATE INDEX IF NOT EXISTS idx_user_topic_preferences_preference ON public.user_topic_preferences(preference);

-- =============================================
-- SEED CURATED GLOBAL TOPICS
-- =============================================
INSERT INTO public.topics (slug, label, description, is_featured, created_by)
VALUES
  ('leadership', 'Leadership', 'People-first leadership, culture building, and decision frameworks.', true, NULL),
  ('fundraising', 'Fundraising', 'Investor updates, pitch prep, and capital strategy.', true, NULL),
  ('marketing', 'Marketing', 'Acquisition playbooks, campaigns, and brand storytelling.', true, NULL),
  ('growth', 'Growth', 'Experiments, funnels, and retention tactics.', true, NULL),
  ('product', 'Product', 'Roadmaps, research, launches, and feedback loops.', true, NULL),
  ('design', 'Design', 'Visual systems, UX best practices, and creative direction.', false, NULL),
  ('engineering', 'Engineering', 'Technical deep dives, architecture, and tooling.', false, NULL),
  ('operations', 'Operations', 'Processes, systems, and scaling the business engine.', false, NULL),
  ('sales', 'Sales', 'Outbound, enablement, and closing enterprise deals.', false, NULL),
  ('customersuccess', 'Customer Success', 'Onboarding, advocacy, and retention programs.', false, NULL),
  ('communitybuilding', 'Community Building', 'Member engagement, programming, and moderation.', true, NULL),
  ('events', 'Events', 'IRL + virtual experiences, runbooks, and recaps.', false, NULL),
  ('content', 'Content', 'Editorial calendars, creator workflows, and distribution.', false, NULL),
  ('creators', 'Creators', 'Monetization, collaborations, and platform strategy.', false, NULL),
  ('startups', 'Startups', 'Zero-to-one stories, founder lessons, and resilience.', true, NULL),
  ('ai', 'AI', 'Practical AI workflows, agents, and responsible adoption.', true, NULL),
  ('nocode', 'No-Code', 'Tools, automations, and rapid prototyping.', false, NULL),
  ('automation', 'Automation', 'Systems that remove manual busywork.', false, NULL),
  ('finance', 'Finance', 'Forecasting, runway, and cash management.', false, NULL),
  ('investing', 'Investing', 'Angel theses, portfolio updates, and market signals.', false, NULL),
  ('talent', 'Talent', 'Hiring pipelines, interviews, and performance reviews.', false, NULL),
  ('remotework', 'Remote Work', 'Distributed-first rituals, tools, and async etiquette.', false, NULL),
  ('wellness', 'Wellness', 'Founder health, burnout prevention, and routines.', false, NULL),
  ('mindset', 'Mindset', 'High-leverage habits and mental models.', false, NULL),
  ('education', 'Education', 'Learning design, cohorts, and curriculum builds.', false, NULL),
  ('career', 'Career', 'Transitions, leveling guides, and mentorship.', false, NULL),
  ('mentorship', 'Mentorship', 'Office hours, mentorship programs, and best practices.', false, NULL),
  ('networking', 'Networking', 'Intros, deal flow, and community serendipity.', false, NULL),
  ('web3', 'Web3', 'Decentralized products, governance, and token design.', false, NULL),
  ('climate', 'Climate', 'Climate tech, policy, and sustainability projects.', false, NULL),
  ('healthtech', 'Healthtech', 'Digital health, biotech, and care delivery.', false, NULL),
  ('fintech', 'Fintech', 'Payments, compliance, and financial infrastructure.', false, NULL),
  ('futureofwork', 'Future of Work', 'Workplace trends, tooling, and labor shifts.', false, NULL),
  ('fundamentals', 'Fundamentals', 'Company-building basics and timeless lessons.', false, NULL),
  ('legal', 'Legal', 'Contracts, compliance, and risk mitigation.', false, NULL),
  ('storytelling', 'Storytelling', 'Narratives that move teams, investors, and customers.', false, NULL),
  ('publicspeaking', 'Public Speaking', 'Presentation prep, stage craft, and confidence.', false, NULL),
  ('philanthropy', 'Philanthropy', 'Giving models, impact measurement, and funding.', false, NULL),
  ('research', 'Research', 'User insights, market sizing, and competitive analysis.', false, NULL),
  ('launch', 'Launch', 'Go-to-market checklists and launch retros.', true, NULL),
  ('playbooks', 'Playbooks', 'Repeatable templates, SOPs, and frameworks.', true, NULL),
  ('spotlight', 'Spotlight', 'Member wins, case studies, and milestone shoutouts.', true, NULL),
  ('viral', 'Viral', 'Content exploding in popularity.', true, NULL),
  ('trending', 'Trending', 'What''s hot right now.', true, NULL),
  ('fyp', 'FYP', 'For You Page algorithm boost.', false, NULL),
  ('foryou', 'ForYou', 'TikTok/Instagram discovery page.', false, NULL),
  ('explore', 'Explore', 'Instagram explore/feed visibility.', false, NULL),
  ('explorepage', 'ExplorePage', 'Reach new audiences on IG.', false, NULL),
  ('viralvideos', 'ViralVideos', 'Videos going massively viral.', true, NULL),
  ('trendingnow', 'TrendingNow', 'Current hot trends.', true, NULL),
  ('viralpost', 'ViralPost', 'Posts blowing up.', false, NULL),
  ('mustsee', 'MustSee', 'Eye-catching must-watch content.', false, NULL),
  ('wow', 'Wow', 'Shocking or amazing moments.', false, NULL),
  ('epic', 'Epic', 'Grand, impressive content.', false, NULL),
  ('mindblown', 'MindBlown', 'Mind-bending facts or reveals.', false, NULL),
  ('lifehack', 'LifeHack', 'Clever everyday shortcuts.', false, NULL),
  ('protip', 'ProTip', 'Professional quick advice.', false, NULL),
  ('hack', 'Hack', 'Smart tricks to save time/money.', false, NULL),
  ('tipsandtricks', 'TipsAndTricks', 'Helpful tips collection.', false, NULL),
  ('dailytips', 'DailyTips', 'Everyday useful advice.', false, NULL),
  ('tech', 'Tech', 'All things technology.', true, NULL),
  ('technology', 'Technology', 'Gadgets and innovations.', false, NULL),
  ('app', 'App', 'Mobile applications.', false, NULL),
  ('mobileapp', 'MobileApp', 'Smartphone apps.', false, NULL),
  ('newapp', 'NewApp', 'Freshly launched applications.', false, NULL),
  ('appdevelopment', 'AppDevelopment', 'Building apps.', false, NULL),
  ('appdeveloper', 'AppDeveloper', 'People who code apps.', false, NULL),
  ('android', 'Android', 'Google''s mobile OS.', false, NULL),
  ('ios', 'iOS', 'Apple''s mobile OS.', false, NULL),
  ('iphone', 'iPhone', 'Apple smartphone.', false, NULL),
  ('androidapp', 'AndroidApp', 'Apps for Android devices.', false, NULL),
  ('appstore', 'AppStore', 'Apple''s app marketplace.', false, NULL),
  ('googleplay', 'GooglePlay', 'Android app store.', false, NULL),
  ('technews', 'TechNews', 'Latest technology updates.', false, NULL),
  ('gadgets', 'Gadgets', 'Cool electronic devices.', false, NULL),
  ('smartphone', 'Smartphone', 'Modern mobile phones.', false, NULL),
  ('artificialintelligence', 'ArtificialIntelligence', 'Machines thinking smart.', false, NULL),
  ('machinelearning', 'MachineLearning', 'AI that learns from data.', false, NULL),
  ('coding', 'Coding', 'Writing code.', false, NULL),
  ('programming', 'Programming', 'Software creation.', false, NULL),
  ('developer', 'Developer', 'Software coder.', false, NULL),
  ('software', 'Software', 'Programs and apps.', false, NULL),
  ('techstartup', 'TechStartup', 'Technology-based new business.', false, NULL),
  ('innovation', 'Innovation', 'New ideas and inventions.', false, NULL),
  ('futuretech', 'FutureTech', 'Upcoming technology.', false, NULL),
  ('cybersecurity', 'CyberSecurity', 'Protecting against hackers.', false, NULL),
  ('blockchain', 'Blockchain', 'Decentralized ledger tech.', false, NULL),
  ('crypto', 'Crypto', 'Cryptocurrency.', false, NULL),
  ('metaverse', 'Metaverse', 'Virtual worlds.', false, NULL),
  ('ar', 'AR', 'Augmented Reality.', false, NULL),
  ('vr', 'VR', 'Virtual Reality.', false, NULL),
  ('augmentedreality', 'AugmentedReality', 'Overlay digital on real world.', false, NULL),
  ('virtualreality', 'VirtualReality', 'Fully immersive digital worlds.', false, NULL),
  ('5g', '5G', 'Fast mobile internet.', false, NULL),
  ('iot', 'IoT', 'Internet of Things.', false, NULL),
  ('internetofthings', 'InternetOfThings', 'Connected smart devices.', false, NULL),
  ('cloudcomputing', 'CloudComputing', 'Online data storage.', false, NULL),
  ('bigdata', 'BigData', 'Massive data analysis.', false, NULL),
  ('fitness', 'Fitness', 'Physical exercise.', false, NULL),
  ('workout', 'Workout', 'Exercise sessions.', false, NULL),
  ('gym', 'Gym', 'Gym culture and training.', false, NULL),
  ('fitnessmotivation', 'FitnessMotivation', 'Inspiring gym content.', false, NULL),
  ('health', 'Health', 'Overall well-being.', false, NULL),
  ('healthylifestyle', 'HealthyLifestyle', 'Living healthy daily.', false, NULL),
  ('fitlife', 'FitLife', 'Lifestyle of fitness.', false, NULL),
  ('gymlife', 'GymLife', 'Dedicated gym goers.', false, NULL),
  ('bodybuilding', 'Bodybuilding', 'Building muscle mass.', false, NULL),
  ('weightloss', 'WeightLoss', 'Losing body fat.', false, NULL),
  ('fatloss', 'FatLoss', 'Targeted fat reduction.', false, NULL),
  ('musclegain', 'MuscleGain', 'Growing muscle.', false, NULL),
  ('fitfam', 'FitFam', 'Fitness community.', false, NULL),
  ('fitnessjourney', 'FitnessJourney', 'Personal progress.', false, NULL),
  ('homeworkout', 'HomeWorkout', 'Exercise at home.', false, NULL),
  ('cardio', 'Cardio', 'Heart-pumping workouts.', false, NULL),
  ('hiit', 'HIIT', 'High-Intensity Interval Training.', false, NULL),
  ('yoga', 'Yoga', 'Mind-body practice.', false, NULL),
  ('meditation', 'Meditation', 'Mindfulness and calm.', false, NULL),
  ('mentalhealth', 'MentalHealth', 'Emotional well-being.', false, NULL),
  ('nutrition', 'Nutrition', 'Food and diet science.', false, NULL),
  ('healthyeating', 'HealthyEating', 'Clean food choices.', false, NULL),
  ('mealprep', 'MealPrep', 'Pre-making meals.', false, NULL),
  ('keto', 'Keto', 'Ketogenic low-carb diet.', false, NULL),
  ('vegan', 'Vegan', 'Plant-based no animal products.', false, NULL),
  ('plantbased', 'PlantBased', 'Mostly plants diet.', false, NULL),
  ('running', 'Running', 'Jogging and marathons.', false, NULL),
  ('marathon', 'Marathon', 'Long-distance running.', false, NULL),
  ('crossfit', 'CrossFit', 'Intense functional training.', false, NULL),
  ('pilates', 'Pilates', 'Core strength exercises.', false, NULL),
  ('strengthtraining', 'StrengthTraining', 'Lifting for power.', false, NULL),
  ('fashion', 'Fashion', 'Clothing trends.', false, NULL),
  ('style', 'Style', 'Personal fashion sense.', false, NULL),
  ('ootd', 'OOTD', 'Outfit Of The Day.', false, NULL),
  ('outfitoftheday', 'OutfitOfTheDay', 'Daily outfit posts.', false, NULL),
  ('fashionstyle', 'FashionStyle', 'Trendy looks.', false, NULL),
  ('beauty', 'Beauty', 'Makeup and skincare.', false, NULL),
  ('makeup', 'Makeup', 'Cosmetics application.', false, NULL),
  ('skincare', 'Skincare', 'Skin health routines.', false, NULL),
  ('haircare', 'Haircare', 'Hair maintenance.', false, NULL),
  ('fashionblogger', 'FashionBlogger', 'Fashion influencers.', false, NULL),
  ('streetstyle', 'StreetStyle', 'Casual urban looks.', false, NULL),
  ('luxuryfashion', 'LuxuryFashion', 'High-end designer brands.', false, NULL),
  ('vintage', 'Vintage', 'Retro clothing.', false, NULL),
  ('trendy', 'Trendy', 'Current hot styles.', false, NULL),
  ('chic', 'Chic', 'Elegant and stylish.', false, NULL),
  ('glam', 'Glam', 'Glamorous looks.', false, NULL),
  ('model', 'Model', 'Fashion modeling.', false, NULL),
  ('fashioninspo', 'FashionInspo', 'Outfit inspiration.', false, NULL),
  ('beautytips', 'BeautyTips', 'Makeup/skincare advice.', false, NULL),
  ('makeuptutorial', 'MakeupTutorial', 'Step-by-step makeup.', false, NULL),
  ('nails', 'Nails', 'Nail art and care.', false, NULL),
  ('hairstyle', 'HairStyle', 'Hairstyling ideas.', false, NULL),
  ('fashionweek', 'FashionWeek', 'Major fashion events.', false, NULL),
  ('designer', 'Designer', 'Clothing designers.', false, NULL),
  ('couture', 'Couture', 'Custom high fashion.', false, NULL),
  ('travel', 'Travel', 'Exploring the world.', false, NULL),
  ('wanderlust', 'Wanderlust', 'Strong desire to travel.', false, NULL),
  ('travelgram', 'TravelGram', 'Instagram travel posts.', false, NULL),
  ('adventure', 'Adventure', 'Thrilling experiences.', false, NULL),
  ('vacation', 'Vacation', 'Holiday trips.', false, NULL),
  ('travelphotography', 'TravelPhotography', 'Scenic travel pics.', false, NULL),
  ('nature', 'Nature', 'Outdoor natural beauty.', false, NULL),
  ('beach', 'Beach', 'Sandy shores and ocean.', false, NULL),
  ('mountains', 'Mountains', 'Hiking and peaks.', false, NULL),
  ('hiking', 'Hiking', 'Trail walking.', false, NULL),
  ('roadtrip', 'RoadTrip', 'Car journeys.', false, NULL),
  ('backpacking', 'Backpacking', 'Budget travel.', false, NULL),
  ('travelblogger', 'TravelBlogger', 'Travel influencers.', false, NULL),
  ('tourism', 'Tourism', 'Visiting attractions.', false, NULL),
  ('paradise', 'Paradise', 'Dream destinations.', false, NULL),
  ('sunset', 'Sunset', 'Evening sky photos.', false, NULL),
  ('citylife', 'CityLife', 'Urban exploration.', false, NULL),
  ('europe', 'Europe', 'European travel.', false, NULL),
  ('asia', 'Asia', 'Asian destinations.', false, NULL),
  ('usa', 'USA', 'American travel spots.', false, NULL),
  ('travelgoals', 'TravelGoals', 'Dream trips.', false, NULL),
  ('bucketlist', 'BucketList', 'Must-do experiences.', false, NULL),
  ('globetrotter', 'GlobeTrotter', 'World traveler.', false, NULL),
  ('solotravel', 'SoloTravel', 'Traveling alone.', false, NULL),
  ('familytravel', 'FamilyTravel', 'Trips with kids.', false, NULL),
  ('food', 'Food', 'Delicious eats.', false, NULL),
  ('foodie', 'Foodie', 'Food lovers.', false, NULL),
  ('foodporn', 'FoodPorn', 'Mouthwatering food pics.', false, NULL),
  ('instafood', 'InstaFood', 'Instagram-worthy meals.', false, NULL),
  ('delicious', 'Delicious', 'Tasty food.', false, NULL),
  ('yummy', 'Yummy', 'Super appetizing.', false, NULL),
  ('cooking', 'Cooking', 'Preparing food.', false, NULL),
  ('recipe', 'Recipe', 'Food instructions.', false, NULL),
  ('homemade', 'Homemade', 'Made at home.', false, NULL),
  ('foodblog', 'FoodBlog', 'Food influencers.', false, NULL),
  ('healthyfood', 'HealthyFood', 'Nutritious meals.', false, NULL),
  ('veganfood', 'VeganFood', 'Plant-based dishes.', false, NULL),
  ('dessert', 'Dessert', 'Sweet treats.', false, NULL),
  ('baking', 'Baking', 'Oven goodies.', false, NULL),
  ('coffee', 'Coffee', 'Coffee culture.', false, NULL),
  ('breakfast', 'Breakfast', 'Morning meals.', false, NULL),
  ('lunch', 'Lunch', 'Midday food.', false, NULL),
  ('dinner', 'Dinner', 'Evening meals.', false, NULL),
  ('pizza', 'Pizza', 'Everyone''s favorite.', false, NULL),
  ('sushi', 'Sushi', 'Japanese raw fish rolls.', false, NULL),
  ('tacos', 'Tacos', 'Mexican street food.', false, NULL),
  ('burger', 'Burger', 'Juicy hamburgers.', false, NULL),
  ('foodphotography', 'FoodPhotography', 'Beautiful food shots.', false, NULL),
  ('chef', 'Chef', 'Professional cooks.', false, NULL),
  ('kitchen', 'Kitchen', 'Cooking space.', false, NULL),
  ('mealideas', 'MealIdeas', 'What to eat today.', false, NULL),
  ('entrepreneur', 'Entrepreneur', 'Business starters.', false, NULL),
  ('entrepreneurship', 'Entrepreneurship', 'Starting companies.', false, NULL),
  ('businessowner', 'BusinessOwner', 'Own your own company.', false, NULL),
  ('hustle', 'Hustle', 'Hard work grind.', false, NULL),
  ('success', 'Success', 'Achieving goals.', false, NULL),
  ('motivation', 'Motivation', 'Drive to succeed.', false, NULL),
  ('inspiration', 'Inspiration', 'Ideas that spark.', false, NULL),
  ('money', 'Money', 'Wealth and finance.', false, NULL),
  ('stocks', 'Stocks', 'Stock market.', false, NULL),
  ('cryptocurrency', 'CryptoCurrency', 'Digital money.', false, NULL),
  ('sidehustle', 'SideHustle', 'Extra income streams.', false, NULL),
  ('passiveincome', 'PassiveIncome', 'Money while sleeping.', false, NULL),
  ('digitalmarketing', 'DigitalMarketing', 'Online promotion.', false, NULL),
  ('seo', 'SEO', 'Search engine optimization.', false, NULL),
  ('socialmediamarketing', 'SocialMediaMarketing', 'Social ads.', false, NULL),
  ('brand', 'Brand', 'Company identity.', false, NULL),
  ('goals', 'Goals', 'Targets to hit.', false, NULL),
  ('productivity', 'Productivity', 'Getting more done.', false, NULL),
  ('timemanagement', 'TimeManagement', 'Organizing your day.', false, NULL)
ON CONFLICT (slug) DO NOTHING;


