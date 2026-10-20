/** Public, cacheable catalog: independent from orders/Firebase. Replace with a restaurant's published menu. */
const pizzaImage='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80';
const pizza2Image='https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80';
const burgerImage='https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80';
const kebabImage='https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=700&q=80';
const pizza=(id,name,description,medium,large,image=pizzaImage)=>({
  id,name,description,image,allergens:['Melk','Hvete (gluten)'],
  ingredients:['Ost','Tomatsaus',...description.replace(/\.$/,'').split(',').map(x=>x.trim()).filter(Boolean)],
  sizes:[{id:'medium',name:'Medium',price:medium},{id:'stor',name:'Stor',price:large}],
  defaultSizeId:'stor',optionGroupIds:['pizza-saus','pizza-side']
});
export const catalog={
  version:'beta-demo-20261020-a',
  allergens:['Melk','Hvete (gluten)','Egg','Sennep','Selleri','Soya','Fisk','Sesam'],
  optionGroups:{
    'pizza-saus':{id:'pizza-saus',title:'Velg saus',required:false,multiple:true,max:2,options:[
      {id:'hvitlok',label:'Hvitløkssaus',price:25},{id:'bearnaise',label:'Béarnaisesaus',price:25}
    ]},
    'pizza-side':{id:'pizza-side',title:'Pommes frites på pizzaen? (stor)',required:false,multiple:false,onlySizes:['stor'],options:[
      {id:'pommes',label:'Ja, takk!',price:49}
    ]},
    'burger-side':{id:'burger-side',title:'Velg tilbehør',required:false,multiple:false,options:[
      {id:'fries',label:'Pommes frites',price:35},{id:'salad',label:'Ekstra salat',price:15}
    ]},
    'kebab-sauce':{id:'kebab-sauce',title:'Velg saus',required:true,multiple:false,options:[
      {id:'mild',label:'Mild',price:0},{id:'medium',label:'Medium',price:0},{id:'sterk',label:'Sterk',price:0}
    ]}
  },
  categories:[
    {id:'pizza',name:'Pizza',icon:'🍕',description:'Medium: 1 person. Stor: 2–3 personer. Bildene er illustrasjonsbilder.',
      products:[
        pizza('classico','1. Classico','Skinke eller pepperoni.',189,294),
        pizza('capri','2. Capri','Skinke, bacon, sopp.',199,304,pizza2Image),
        pizza('alcapone','3. Al Capone','Pepperoni, biff, paprika, løk.',209,314),
        pizza('ciaociao','12. Ciao Ciao','Biff, skinke, champignon.',209,319,pizza2Image)
      ]},
    {id:'kebab',name:'Kebabretter',icon:'🥙',description:'Laget fersk ved bestilling.',
      products:[
        {id:'kebabrull',name:'Kebabrull',description:'Kjøtt, salat, løk og dressing.',image:kebabImage,allergens:['Hvete (gluten)','Melk'],ingredients:['Kjøtt','Salat','Løk','Dressing'],sizes:[{id:'standard',name:'Standard',price:159}],defaultSizeId:'standard',optionGroupIds:['kebab-sauce']},
        {id:'kebabtallerken',name:'Kebabtallerken',description:'Med salat og pommes frites.',image:kebabImage,allergens:['Melk'],ingredients:['Kjøtt','Salat','Pommes frites'],sizes:[{id:'standard',name:'Standard',price:199}],defaultSizeId:'standard',optionGroupIds:['kebab-sauce']}
      ]},
    {id:'burger',name:'Hjemmelagde burgere',icon:'🍔',description:'Saftige burgere med ferskt tilbehør.',
      products:[
        {id:'burgertallerken',name:'Hamburger Tallerken',description:'Serveres med sprø salat, dressing, løk, tomater og pommes frites.',image:burgerImage,allergens:['Melk','Egg','Sennep','Selleri','Hvete (gluten)'],ingredients:['Burger','Salat','Dressing','Løk','Tomater','Pommes frites'],sizes:[{id:'standard',name:'Standard',price:209}],defaultSizeId:'standard',optionGroupIds:['burger-side']},
        {id:'cheeseburger',name:'Cheeseburger',description:'Med ost, salat og dressing.',image:burgerImage,allergens:['Melk','Hvete (gluten)'],ingredients:['Burger','Ost','Salat','Dressing'],sizes:[{id:'standard',name:'Standard',price:179}],defaultSizeId:'standard',optionGroupIds:['burger-side']}
      ]},
    {id:'annet',name:'Andre retter',icon:'🍴',description:'Noe for enhver smak.',products:[
      {id:'pommes',name:'Pommes frites',description:'Sprø og gyldne.',image:'',allergens:[],ingredients:[],sizes:[{id:'standard',name:'Standard',price:59}],defaultSizeId:'standard',optionGroupIds:[]}
    ]}
  ],
  popularIds:['classico','burgertallerken']
};
