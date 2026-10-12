"""Convert a GlobalFood export into Bestill menu JSON. Uses numeric price fields."""
import json,re,sys,unicodedata
from pathlib import Path

def clean(value): return unicodedata.normalize('NFKC', str(value or '')).strip()
def convert(source):
    groups={};allergens={};notes=[];sections=[]
    def group_ids(raw):
        ids=[]
        for g in sorted(raw or [],key=lambda g:g.get('sort',0)):
            if 'lojalitet' in clean(g.get('name')).lower():continue
            gid='gf_group_'+str(g['id']);ids.append(gid)
            options=[{'id':'gf_option_'+str(o['id']),'label':clean(o['name']),'price':float(o.get('price') or 0),'soldOut':bool(o.get('is_out_of_stock'))}for o in sorted(g.get('options',[]),key=lambda o:o.get('sort',0))]
            groups[gid]={'id':gid,'title':clean(g['name']),'selectionMode':'multiple' if int(g.get('force_max') or 1)>1 else 'single','required':bool(g.get('required')),'minSelections':int(g.get('force_min') or 1) if g.get('required') else 0,'maxSelections':int(g.get('force_max') or 1),'allowQuantity':bool(g.get('allow_quantity')),'defaultOptionIds':['gf_option_'+str(o['id'])for o in g.get('options',[])if o.get('default') and not o.get('is_out_of_stock')],'options':options}
        return ids
    mapping={'melk':('melk','Melk'),'hvete':('gluten','Hvete (gluten)'),'sennep':('sennep','Sennep'),'egg':('egg','Egg'),'fisk':('fisk','Fisk'),'ansjos (fisk)':('fisk','Fisk'),'nøtter':('notter','Nøtter'),'selleri':('selleri','Selleri'),'soya':('soya','Soya')}
    for c in sorted(source['categories'],key=lambda c:c.get('sort',0)):
        items=[]
        for i in sorted(c.get('items',[]),key=lambda i:i.get('sort',0)):
            desc=clean(i.get('description'));original=desc
            if '➔' in desc:desc=desc.split('➔',1)[1].strip()
            if desc!=original:notes.append(f"{clean(i['name'])}: old description prices removed; numeric fields used.")
            common=group_ids(i.get('groups'));sizes=[]
            for z in i.get('sizes') or [{'id':'standard','name':'Standard','price':0,'default':True}]:
                label=clean(z['name']);label='Stor' if label.casefold().startswith('stor') else 'Medium' if label.casefold().startswith('medium') else label
                sizes.append({'id':'gf_size_'+str(z['id']),'label':label,'price':round(float(i.get('price') or 0)+float(z.get('price') or 0),2),'optionGroupIds':group_ids(z.get('groups'))})
            ids=[]
            for a in (i.get('extras') or {}).get('menu_item_allergens_values',[]):
                name=clean(a['name']);aid,label=mapping.get(name.casefold(),('gf_allergen_'+str(a['id']),name));allergens[aid]={'id':aid,'label':label};ids.append(aid)
            items.append({'id':'gf_item_'+str(i['id']),'name':clean(i['name']),'description':desc,'ingredients':clean(i.get('ingredients')),'ingredientRules':[],'imageUrl':'','sizes':sizes,'defaultSizeIndex':next((n for n,z in enumerate(i.get('sizes') or [])if z.get('default')),0),'optionGroupIds':common,'allergens':list(dict.fromkeys(ids)),'hidden':not(i.get('active',True) and c.get('active',True)),'soldOut':bool(i.get('is_out_of_stock'))})
        sections.append({'id':'gf_category_'+str(c['id']),'title':clean(c['name']),'note':clean(c.get('description')),'type':'pizza' if 'pizza' in clean(c['name']).lower() else '', 'imageUrl':'','items':items})
    return {'schemaVersion':6,'sections':sections,'optionGroups':list(groups.values()),'allergenCatalog':list(allergens.values()),'popularItemIds':[],'importNotes':notes+['No restaurant settings, photos, opening hours or invented ingredients included.','Size prices are item.price + size.price; loyalty advertisement omitted.']}

if __name__=='__main__':
    data=convert(json.loads(Path(sys.argv[1]).read_text()));Path(sys.argv[2]).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(f"Converted {len(data['sections'])} categories / {sum(len(s['items'])for s in data['sections'])} items / {len(data['optionGroups'])} option groups.")
