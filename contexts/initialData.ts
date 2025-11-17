import type { Player, Team } from '../types';

export const initialPlayers: Player[] = [
  { id: 'p1', name: 'Adyaa Mirkute', role: 'All-Rounder' },
  { id: 'p2', name: 'Rahee Shinde', role: 'All-Rounder' },
  { id: 'p3', name: 'Priya Alankar', role: 'All-Rounder' },
  { id: 'p4', name: 'Tejshree Nanaware', role: 'All-Rounder' },
  { id: 'p5', name: 'Amruta Shimbre', role: 'All-Rounder' },
  { id: 'p6', name: 'Rajdeep Kaur', role: 'All-Rounder' },
  { id: 'p7', name: 'Upma Pal', role: 'All-Rounder' },
  { id: 'p8', name: 'Madhuri Ladkat', role: 'All-Rounder' },

  { id: 'p9', name: 'Anvika Sadawarte', role: 'All-Rounder' },
  { id: 'p10', name: 'Mayuri Devane', role: 'All-Rounder' },
  { id: 'p11', name: 'Viha Kotkar', role: 'All-Rounder' },
  { id: 'p12', name: 'Rohini Sabban', role: 'All-Rounder' },
  { id: 'p13', name: 'Ovee Parmale', role: 'All-Rounder' },
  { id: 'p14', name: 'Shalaka Hase', role: 'All-Rounder' },
  { id: 'p15', name: 'Renuka Naik', role: 'All-Rounder' },
  { id: 'p16', name: 'Rinku Wagh', role: 'All-Rounder' },

  { id: 'p17', name: 'Aryaa Mirkute', role: 'All-Rounder' },
  { id: 'p18', name: 'Sonali Tayade', role: 'All-Rounder' },
  { id: 'p19', name: 'Poorva Wagh', role: 'All-Rounder' },
  { id: 'p20', name: 'Megha Sadawarte', role: 'All-Rounder' },
  { id: 'p21', name: 'Jayashree Shimpi', role: 'All-Rounder' },
  { id: 'p22', name: 'Dhanashree Dethe', role: 'All-Rounder' },
  { id: 'p23', name: 'Daksha Tendulkar', role: 'All-Rounder' },
  { id: 'p24', name: 'Kiran Urikde', role: 'All-Rounder' },

  { id: 'p25', name: 'Snehal Bhushetty', role: 'All-Rounder' },
  { id: 'p26', name: 'Jyoti Kotkar', role: 'All-Rounder' },
  { id: 'p27', name: 'Pratiksha Manchalwar', role: 'All-Rounder' },
  { id: 'p28', name: 'Reva Karne', role: 'All-Rounder' },
  { id: 'p29', name: 'Mohini Shinde', role: 'All-Rounder' },
  { id: 'p30', name: 'Megha Jamdade', role: 'All-Rounder' },
  { id: 'p31', name: 'Riddhi Sadawarte', role: 'All-Rounder' },
  { id: 'p32', name: 'Spruha Wagh', role: 'All-Rounder' },
];


export const initialTeams: Team[] = [
  {
    id: 't1',
    name: 'Bhanani Braves',
    playerIds: ['p1','p2','p3','p4','p5','p6','p7','p8'],
  },
  {
    id: 't2',
    name: 'Hirkani Climbers',
    playerIds: ['p9','p10','p11','p12','p13','p14','p15','p16'],
  },
  {
    id: 't3',
    name: 'Yuvati Warriors',
    playerIds: ['p17','p18','p19','p20','p21','p22','p23','p24'],
  },
  {
    id: 't4',
    name: 'Veerangana Yoddhe',
    playerIds: ['p25','p26','p27','p28','p29','p30','p31','p32'],
  },
];