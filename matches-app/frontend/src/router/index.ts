import { createRouter, createWebHistory } from 'vue-router';
import MatchesView from '../views/MatchesView.vue';
import MatchDetailView from '../views/MatchDetailView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'matches',
      component: MatchesView,
    },
    {
      path: '/match/:id',
      name: 'match-detail',
      component: MatchDetailView,
      props: true,
    },
    {
      path: '/competition/:id',
      name: 'competition-detail',
      component: () => import('../views/CompetitionDetailView.vue'),
      props: true,
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
